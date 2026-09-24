'use strict';

const makeWASocket = require('@whiskeysockets/baileys').default;
const messageAckWaiters = new Map();
const {
    useMultiFileAuthState,
    DisconnectReason,
    downloadContentFromMessage,
    getContentType,
    normalizeMessageContent,
} = require('@whiskeysockets/baileys');

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

let baileysLogger = null;

try {
    const pino = require('pino');
    const level = process.env.BAILEYS_LOG_LEVEL || 'info';

    baileysLogger = pino({ level });
} catch (error) {
    console.warn(
        'pino not available, falling back to default Baileys logger'
    );
}

const PORT = Number(process.env.PORT || 3001);

const AUTH_DIR =
    process.env.AUTH_DIR || path.join(__dirname, 'auth_sessions');

const CRM_BASE_URL =
    process.env.CRM_BACKEND_URL ||
    process.env.BACKEND_URL ||
    'http://localhost:8000';

const CRM_INGEST_TOKEN =
    process.env.WHATSAPP_BAILEYS_INGEST_TOKEN || '$crmLiliya';

const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const QR_EXPIRY_MS = 5 * 60 * 1000;

const profilePhotoCache = new Map();

/**
 * Active tenant connections.
 *
 * Map<tenantId, {
 *   sock,
 *   status,
 *   creating,
 *   restarting,
 *   reconnect,
 *   connectionState,
 *   qr,
 *   me,
 *   qrExpiryTimer,
 *   reconnectTimer,
 *   reconnectAttempts,
 *   createdAt,
 *   lastDisconnectReason
 * }>
 */
const connections = new Map();

/**
 * Prevent concurrent socket creation for the same tenant.
 */
const connectionCreationPromises = new Map();

fs.mkdirSync(AUTH_DIR, { recursive: true });

/**
 * Tenant IDs are used as directory names.
 * Do not allow path traversal.
 */
function assertValidTenantId(tenantId) {
    const value = String(tenantId || '').trim();

    if (!value || !/^[a-zA-Z0-9_-]+$/.test(value)) {
        throw new Error('Invalid tenant ID');
    }

    return value;
}

function getTenantAuthPath(tenantId) {
    return path.join(AUTH_DIR, assertValidTenantId(tenantId));
}

function getMessageAckKey(tenantId, messageId) {
    return `${tenantId}:${messageId}`;
}

function waitForMessageDelivery(
    tenantId,
    messageId,
    timeoutMs = 20000
) {
    const ackKey = getMessageAckKey(
        tenantId,
        messageId
    );

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            messageAckWaiters.delete(ackKey);

            reject(
                new Error(
                    `No delivery acknowledgement received for ` +
                        `message ${messageId} within ${timeoutMs}ms`
                )
            );
        }, timeoutMs);

        messageAckWaiters.set(ackKey, {
            resolve: (result) => {
                clearTimeout(timeout);
                messageAckWaiters.delete(ackKey);
                resolve(result);
            },
            reject: (error) => {
                clearTimeout(timeout);
                messageAckWaiters.delete(ackKey);
                reject(error);
            },
        });
    });
}

/**
 * Permanently removes a tenant session.
 *
 * This function must not be called for DisconnectReason.restartRequired
 * or any temporary reconnect condition.
 */
function removeTenantSession(tenantId) {
    const conn = connections.get(tenantId);

    // Delete the map entry before ending the socket so that a late
    // connection.update event from the old socket is ignored.
    if (conn) {
        connections.delete(tenantId);

        if (conn.qrExpiryTimer) {
            clearTimeout(conn.qrExpiryTimer);
            conn.qrExpiryTimer = null;
        }

        if (conn.reconnectTimer) {
            clearTimeout(conn.reconnectTimer);
            conn.reconnectTimer = null;
        }

        try {
            if (conn.sock) {
                conn.sock.end(undefined);
            }
        } catch (error) {
            console.error(
                `[${tenantId}] Failed to close socket during cleanup:`,
                error
            );
        }
    }

    const authPath = getTenantAuthPath(tenantId);

    if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, {
            recursive: true,
            force: true,
        });
    }
}

/**
 * Extracts the E.164 phone number from a WhatsApp JID.
 *
 * Priority order:
 * 1. senderPn (msg.key.senderPn) — Baileys sets this to @s.whatsapp.net alongside @lid
 * 2. signalRepository.lidMapping.getPNForLID() — Baileys' own LID→PN mapping store
 * 3. Direct extraction for @s.whatsapp.net / @c.us JIDs (strip device suffix after ':')
 * 4. Returns null if none of the above work
 */
async function resolvePhoneFromJid(sock, remoteJid, senderPn) {
    // Helper: extract clean phone from a @s.whatsapp.net or @c.us JID
    // strips device suffix, e.g. "34603749745:27@s.whatsapp.net" → "+34603749745"
    function phoneFromPnJid(jid) {
        const prefix = String(jid || '').split('@')[0];
        const digits = prefix.split(':')[0].replace(/[^0-9]/g, '');
        if (digits.length >= 7 && digits.length <= 15) {
            return `+${digits}`;
        }
        return null;
    }

    // 1. senderPn is the most direct — Baileys provides it alongside @lid remoteJid
    if (senderPn) {
        const phone = phoneFromPnJid(senderPn);
        if (phone) return phone;
    }

    const value = String(remoteJid || '').trim();

    // 2. @s.whatsapp.net / @c.us — phone is in the prefix
    if (value.endsWith('@s.whatsapp.net') || value.endsWith('@c.us')) {
        return phoneFromPnJid(value);
    }

    // 3. @lid — use Baileys' internal LID→PN mapping store
    if (value.endsWith('@lid')) {
        try {
            const pnJid = await sock.signalRepository?.lidMapping?.getPNForLID(value);
            if (pnJid) {
                const phone = phoneFromPnJid(pnJid);
                if (phone) return phone;
            }
        } catch (e) {
            console.warn(`[resolvePhoneFromJid] getPNForLID failed for ${value}:`, e.message);
        }
        return null;
    }

    return null;
}

/**
 * Sends an incoming WhatsApp message to the CRM.
 */
async function forwardIncomingMessageToCrm(messageData) {
    if (!CRM_INGEST_TOKEN) {
        return false;
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 15000);

    const safeLogData = {
        tenant_id: messageData.tenant_id,
        message_id: messageData.message_id,
        remote_jid: messageData.remote_jid,
        message_type: messageData.message_type,
        outbound: messageData.outbound,
        has_media: Array.isArray(messageData.media)
            && messageData.media.length > 0,
        media_count: Array.isArray(messageData.media)
            ? messageData.media.length
            : 0,
        media_sizes: Array.isArray(messageData.media)
            ? messageData.media.map((media) => ({
                  type: media.type,
                  mime_type: media.mime_type,
                  size: media.size,
                  name: media.name,
              }))
            : [],
    };

    try {
        const response = await fetch(
            `${CRM_BASE_URL}/api/v1/whatsapp-qr/internal/messages`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WhatsApp-Baileys-Token':
                        CRM_INGEST_TOKEN,
                },
                body: JSON.stringify(messageData),
                signal: controller.signal,
            }
        );

        if (!response.ok) {
            const body = await response.text().catch(() => '');

            console.warn(
                `[${messageData.tenant_id}] CRM ingest failed ` +
                    `(${response.status})`,
                {
                    response: body,
                    message: safeLogData,
                }
            );

            return false;
        }

        return true;
    } catch (error) {
        console.warn(
            `[${messageData.tenant_id}] CRM ingest request failed:`,
            {
                error: error.message || error,
                message: safeLogData,
            }
        );

        return false;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Unwraps common WhatsApp message wrappers.
 */
function unwrapMessageContent(content) {
    let current = content;

    const wrappers = [
        'ephemeralMessage',
        'viewOnceMessage',
        'viewOnceMessageV2',
        'viewOnceMessageV2Extension',
        'documentWithCaptionMessage',
    ];

    let changed = true;

    while (changed && current && typeof current === 'object') {
        changed = false;

        for (const wrapper of wrappers) {
            if (current[wrapper]?.message) {
                current = current[wrapper].message;
                changed = true;
                break;
            }
        }
    }

    return current;
}

/**
 * Returns true for message types that carry no conversational content
 * and should not be stored or forwarded to the CRM:
 *   - reactionMessage  — emoji reactions on messages
 *   - protocolMessage  — delivery receipts, ephemeral timers, key refresh
 *   - senderKeyDistributionMessage — group encryption housekeeping
 */
function shouldIgnoreMessageType(contentType) {
    const ignored = new Set([
        'reactionMessage',
        'protocolMessage',
        'senderKeyDistributionMessage',
        'messageContextInfo',
    ]);
    return ignored.has(contentType);
}

function shouldIgnoreMessageJid(jid) {
    const value = String(jid || '').toLowerCase();

    return (
        // Groups, including Community groups and Community announcement groups
        value.endsWith('@g.us') ||

        // WhatsApp Channels
        value.endsWith('@newsletter') ||

        // Broadcast lists
        value.endsWith('@broadcast') ||

        // Status updates
        value === 'status@broadcast'
    );
}

/**
 * Normalizes text and media information from an incoming message.
 */
function normalizeMessageBody(message) {
    const originalContent = message?.message || {};
    const unwrappedContent = unwrapMessageContent(originalContent);

    const content =
        normalizeMessageContent(unwrappedContent) ||
        unwrappedContent ||
        {};

    const contentType = getContentType(content);

    const text =
        content?.conversation ||
        content?.extendedTextMessage?.text ||
        content?.imageMessage?.caption ||
        content?.videoMessage?.caption ||
        content?.documentMessage?.caption ||
        content?.audioMessage?.caption ||
        '';

    const mediaMessage =
        contentType && content[contentType]
            ? content[contentType]
            : null;

    const mediaKind = mediaMessage
        ? contentType.replace(/Message$/, '').toLowerCase()
        : null;

    return {
        text,
        contentType,
        mediaMessage,
        mediaKind,
        content,
    };
}

function hasDownloadableMediaMetadata(mediaMessage) {
    if (!mediaMessage || typeof mediaMessage !== 'object') {
        return false;
    }

    return Boolean(
        mediaMessage.url ||
            mediaMessage.directPath ||
            mediaMessage.mediaKey ||
            mediaMessage.fileEncSha256 ||
            mediaMessage.fileSha256
    );
}

function normalizeWhatsAppJid(jid) {
    return String(jid || '').trim();
}

function normalizeBaileysTimestamp(timestamp) {
    if (timestamp == null) {
        return Math.floor(Date.now() / 1000);
    }

    if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
        return timestamp;
    }

    if (typeof timestamp === 'string' && timestamp.trim()) {
        const parsed = Number(timestamp);

        return Number.isFinite(parsed)
            ? parsed
            : Math.floor(Date.now() / 1000);
    }

    if (typeof timestamp?.toNumber === 'function') {
        const parsed = Number(timestamp.toNumber());

        return Number.isFinite(parsed)
            ? parsed
            : Math.floor(Date.now() / 1000);
    }

    if (typeof timestamp?.toString === 'function') {
        const parsed = Number(timestamp.toString());

        return Number.isFinite(parsed)
            ? parsed
            : Math.floor(Date.now() / 1000);
    }

    return Math.floor(Date.now() / 1000);
}

async function getProfilePhotoUrl(sock, remoteJid) {
    const value = String(remoteJid || '').trim();

    if (
        !value ||
        value.endsWith('@g.us') ||
        value.endsWith('@newsletter') ||
        value.endsWith('@broadcast') ||
        value === 'status@broadcast' ||
        value.endsWith('@lid')
    ) {
        return null;
    }

    if (profilePhotoCache.has(value)) {
        return profilePhotoCache.get(value);
    }

    try {
        const photoUrl = await sock.profilePictureUrl(
            value,
            'image'
        );

        profilePhotoCache.set(value, photoUrl || null);

        return photoUrl || null;
    } catch (error) {
        const errorMessage = String(
            error?.message || error
        ).toLowerCase();

        if (!errorMessage.includes('not found')) {
            console.warn(
                `[${value}] Failed to fetch profile photo:`,
                error.message || error
            );
        }

        profilePhotoCache.set(value, null);

        return null;
    }
}

function mapMediaType(contentType) {
    const normalized = String(contentType || '').toLowerCase();

    if (
        normalized.includes('image') ||
        normalized.includes('sticker')
    ) {
        return 'photo';
    }

    if (normalized.includes('video')) {
        return 'video';
    }

    if (normalized.includes('audio')) {
        return 'audio';
    }

    return 'document';
}

async function downloadMessageMedia(
    message,
    contentType,
    mediaMessage,
    mediaKind
) {
    if (!mediaMessage || !mediaKind) {
        return null;
    }

    if (!hasDownloadableMediaMetadata(mediaMessage)) {
        return null;
    }

    try {
        const stream = await downloadContentFromMessage(
            mediaMessage,
            mediaKind
        );

        const chunks = [];
        let totalBytes = 0;

        for await (const chunk of stream) {
            totalBytes += chunk.length;

            if (totalBytes > MAX_MEDIA_BYTES) {
                console.warn(
                    `[${message.key?.remoteJid || 'unknown'}] ` +
                        `Media exceeds ${MAX_MEDIA_BYTES} bytes`
                );

                return null;
            }

            chunks.push(chunk);
        }

        const buffer = Buffer.concat(chunks);

        if (!buffer.length) {
            return null;
        }

        const mimeType =
            mediaMessage.mimetype ||
            mediaMessage.mimeType ||
            'application/octet-stream';

        const dataUrl =
            `data:${mimeType};base64,` +
            buffer.toString('base64');

        const name =
            mediaMessage.fileName ||
            mediaMessage.filename ||
            mediaMessage.title ||
            message.key?.id ||
            'media';

        const caption = mediaMessage.caption || '';

        return {
            type: mapMediaType(contentType),
            url: dataUrl,
            name,
            mime_type: mimeType,
            size: buffer.length,
            caption,
            payload: {
                url: dataUrl,
                mime_type: mimeType,
                size: buffer.length,
                caption,
            },
        };
    } catch (error) {
        console.warn(
            `[${message.key?.remoteJid || 'unknown'}] ` +
                'Failed to download media:',
            error.message || error
        );

        return null;
    }
}

function clearQrExpiryTimer(conn) {
    if (conn?.qrExpiryTimer) {
        clearTimeout(conn.qrExpiryTimer);
        conn.qrExpiryTimer = null;
    }
}

function scheduleQrExpiry(tenantId, sock) {
    const conn = connections.get(tenantId);

    if (!conn || conn.sock !== sock) {
        return;
    }

    clearQrExpiryTimer(conn);

    conn.qrExpiryTimer = setTimeout(() => {
        const activeConn = connections.get(tenantId);

        if (!activeConn || activeConn.sock !== sock) {
            return;
        }

        if (activeConn.authenticated) {
            return;
        }

        if (!activeConn.qr) {
            return;
        }

        console.log(
            `[${tenantId}] QR expired after 5 minutes; ` +
                'deleting unauthenticated session'
        );

        removeTenantSession(tenantId);
    }, QR_EXPIRY_MS);
}

function calculateReconnectDelay(conn) {
    const attempt = conn.reconnectAttempts || 1;

    const base = 2000;
    const maxDelay = 60000;

    const exponentialDelay = Math.min(
        maxDelay,
        base * Math.pow(2, Math.min(attempt - 1, 6))
    );

    const jitter = Math.floor(
        Math.random() * Math.min(5000, exponentialDelay)
    );

    return Math.max(
        1000,
        Math.min(maxDelay, exponentialDelay + jitter)
    );
}

/**
 * Restarts the WhatsApp socket while preserving auth files.
 *
 * This is used for 515, 408, network errors, etc.
 * It must not call removeTenantSession().
 */
async function restartTenantConnection(tenantId) {
    const current = connections.get(tenantId);

    if (!current || current.restarting) {
        return;
    }

    current.restarting = true;

    if (current.reconnectTimer) {
        clearTimeout(current.reconnectTimer);
        current.reconnectTimer = null;
    }

    const oldSocket = current.sock;

    // Remove the old socket from the active map before closing it.
    // Its late events will then be ignored.
    connections.delete(tenantId);

    try {
        if (oldSocket) {
            oldSocket.end(undefined);
        }
    } catch (error) {
        console.warn(
            `[${tenantId}] Failed to close old socket:`,
            error.message || error
        );
    }

    // Important:
    // Do not delete AUTH_DIR/<tenantId>.
    // The credentials generated after QR pairing are stored there.
    try {
        await getOrCreateConnection(tenantId);

        console.log(
            `[${tenantId}] Replacement socket created using saved auth`
        );
    } catch (error) {
        console.error(
            `[${tenantId}] Failed to create replacement socket:`,
            error.message || error
        );
    }
}

/**
 * Handles connection lifecycle events.
 */
function registerConnectionEvents(
    tenantId,
    sock,
    saveCreds,
    state
) {
   sock.ev.on('creds.update', async () => {
    try {
        await saveCreds();

        const conn = connections.get(tenantId);

        if (conn && conn.sock === sock) {
            conn.authenticated = Boolean(
                state.creds.registered
            );
        }
    } catch (error) {
        console.error(
            `[${tenantId}] Failed to save credentials:`,
            error.message || error
        );
    }
});

    sock.ev.on('connection.update', async (update) => {
        const {
            connection,
            lastDisconnect,
            qr,
        } = update;

        const conn = connections.get(tenantId);

        // Ignore events from an old socket that has already been replaced.
        if (!conn || conn.sock !== sock) {
            return;
        }

        if (lastDisconnect?.error) {
            try {
                console.warn(
                    `[${tenantId}] lastDisconnect detail:`,
                    JSON.stringify(
                        lastDisconnect.error,
                        Object.getOwnPropertyNames(
                            lastDisconnect.error
                        )
                    )
                );
            } catch (error) {
                console.warn(
                    `[${tenantId}] lastDisconnect:`,
                    lastDisconnect.error
                );
            }
        }

        if (qr) {
            conn.qr = qr;
            conn.status = 'awaiting_qr_scan';
            conn.reconnect = false;
            conn.connectionState = 'qr_ready';

            scheduleQrExpiry(tenantId, sock);

            console.log(`[${tenantId}] QR code ready`);
        }

        if (connection === 'open') {
            clearQrExpiryTimer(conn);

            conn.status = 'connected';
            conn.reconnect = false;
            conn.restarting = false;
            conn.connectionState = 'open';
            conn.qr = null;
            conn.me = sock.user;
            conn.reconnectAttempts = 0;

            console.log(`[${tenantId}] Connected`);
            return;
        }

        if (connection !== 'close') {
            return;
        }

        const statusCode =
            lastDisconnect?.error?.output?.statusCode;

        const loggedOut =
            statusCode === DisconnectReason.loggedOut;

        const qrExpired =
            statusCode === 408 &&
            !conn.authenticated &&
            conn.status === 'awaiting_qr_scan';

        const shouldReconnect =
            !loggedOut && !qrExpired;



        conn.status = shouldReconnect
            ? 'reconnecting'
            : 'disconnected';

        conn.reconnect = shouldReconnect;
        conn.connectionState = 'closed';
        conn.lastDisconnectReason = String(
            lastDisconnect?.error?.message ||
                lastDisconnect?.error ||
                'connection closed'
        );

        if (!shouldReconnect) {
            conn.qr = null;

            if (qrExpired) {
                console.log(
                    `[${tenantId}] QR references expired without pairing; ` +
                        'deleting session'
                );
            } else if (loggedOut) {
                console.log(
                    `[${tenantId}] Logged out; deleting auth session`
                );
            }

            removeTenantSession(tenantId);
            return;
        }

        conn.reconnectAttempts =
            (conn.reconnectAttempts || 0) + 1;

        /*
         * 515 is expected immediately after QR pairing.
         * Reconnect quickly while preserving the auth files.
         */
        const isRestartRequired =
            statusCode === DisconnectReason.restartRequired;

        const delay = isRestartRequired
            ? 250
            : calculateReconnectDelay(conn);

        console.log(
            `[${tenantId}] Connection closed with status ${statusCode}. ` +
                `Reconnecting in ${delay}ms`
        );

        if (conn.reconnectTimer) {
            clearTimeout(conn.reconnectTimer);
        }

        conn.reconnectTimer = setTimeout(() => {
            restartTenantConnection(tenantId).catch((error) => {
                console.error(
                    `[${tenantId}] Reconnect failed:`,
                    error.message || error
                );
            });
        }, delay);
    });

    sock.ev.on('messages.update', (updates) => {
        for (const item of updates || []) {
            const messageId = item?.key?.id;

            if (!messageId || !item?.key?.fromMe) {
                continue;
            }

            const status = item?.update?.status;

            const ackKey = getMessageAckKey(
                tenantId,
                messageId
            );

            const waiter = messageAckWaiters.get(ackKey);

            console.log(
                `[${tenantId}] Message acknowledgement`,
                {
                    message_id: messageId,
                    remote_jid: item.key.remoteJid,
                    status,
                }
            );

            if (!waiter) {
                continue;
            }

            /*
            * Baileys message status values are generally:
            *
            * 0 = ERROR
            * 1 = PENDING
            * 2 = SERVER_ACK
            * 3 = DELIVERY_ACK
            * 4 = READ
            * 5 = PLAYED
            */
            if (status === 0) {
                waiter.reject(
                    new Error(
                        `WhatsApp reported an error for message ` +
                            `${messageId}`
                    )
                );

                continue;
            }

            // Status 3 or higher means the recipient device received it
            // or the message was subsequently read/played.
            if (typeof status === 'number' && status >= 3) {
                waiter.resolve({
                    message_id: messageId,
                    status,
                    delivered: true,
                    read: status >= 4,
                });
            }
        }
    });
    sock.ev.on('messages.upsert', async (event) => {
        const messages = event?.messages || [];

        for (const msg of messages) {
            if (
                !msg?.key?.id ||
                !msg?.key?.remoteJid ||
                !msg.message
            ) {
                continue;
            }

            const remoteJid = msg.key.remoteJid;

            /*
            * Ignore:
            * - Normal WhatsApp groups
            * - Community groups
            * - Community announcement groups
            * - WhatsApp Channels
            * - Broadcast lists
            * - WhatsApp status updates
            */
            if (shouldIgnoreMessageJid(remoteJid)) {
                console.log(
                    `[${tenantId}] Ignoring group/community message from ${remoteJid}`
                );

                continue;
            }

            try {
                const normalized = normalizeMessageBody(msg);

                // Skip reactions, protocol messages, and other non-conversational events
                if (shouldIgnoreMessageType(normalized.contentType)) {
                    console.log(
                        `[${tenantId}] Skipping non-conversational message type: ${normalized.contentType} from ${remoteJid}`
                    );
                    continue;
                }

                const media = await downloadMessageMedia(
                    msg,
                    normalized.contentType,
                    normalized.mediaMessage,
                    normalized.mediaKind
                );

                const profilePhotoUrl =
                    await getProfilePhotoUrl(sock, remoteJid);
                const senderJid =
                    msg.key.senderPn ||
                    msg.key.remoteJid;

                // Resolve real E.164 phone number from the JID.
                // senderPn is the reliable @s.whatsapp.net form even in @lid sessions.
                const resolvedPhone = await resolvePhoneFromJid(sock, remoteJid, msg.key.senderPn);

                const messageData = {
                    tenant_id: tenantId,
                    message_id: msg.key.id,

                    // Keep the actual WhatsApp conversation JID.
                    remote_jid: remoteJid,

                    // Useful when remoteJid is a LID.
                    sender_jid: senderJid,

                    // Resolved E.164 phone number (null if not determinable).
                    resolved_phone: resolvedPhone,

                    text:
                        normalized.text ||
                        (media ? '[Media message]' : ''),

                    push_name: msg.pushName || null,

                    timestamp: normalizeBaileysTimestamp(
                        msg.messageTimestamp
                    ),

                    message_type:
                        normalized.contentType || 'unknown',

                    outbound: Boolean(msg.key.fromMe),
                    source: 'baileys',
                    media: media ? [media] : null,
                    profile_photo_url: profilePhotoUrl,
                };

                const delivered =
                    await forwardIncomingMessageToCrm(
                        messageData
                    );

                if (!delivered) {
                    console.warn(
                        `[${tenantId}] CRM ingest unavailable; ` +
                            'message was not delivered'
                    );
                }

                console.log(
                    `[${tenantId}] ` +
                        `${msg.key.fromMe ? 'Sent' : 'Received'} ` +
                        `private message for ${remoteJid}`
                );
            } catch (error) {
                console.error(
                    `[${tenantId}] Failed to process message:`,
                    error.message || error
                );
            }
        }
    });
}

/**
 * Creates one socket for a tenant.
 *
 * This function does not delete auth files.
 */
async function createTenantConnection(tenantId) {
    const safeTenantId = assertValidTenantId(tenantId);
    const authPath = getTenantAuthPath(safeTenantId);

    fs.mkdirSync(authPath, { recursive: true });

    const {
        state,
        saveCreds,
    } = await useMultiFileAuthState(authPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        markOnlineOnConnect: true,
        logger: baileysLogger || undefined,
    });

    const connectionData = {
        sock,
        status: 'connecting',
        creating: false,
        restarting: false,
        reconnect: false,
        authenticated: Boolean(state.creds.registered),
        connectionState: 'connecting',
        qr: null,
        qrExpiryTimer: null,
        reconnectTimer: null,
        reconnectAttempts: 0,
        me: null,
        createdAt: new Date().toISOString(),
        lastDisconnectReason: null,
    };

    connections.set(safeTenantId, connectionData);

    registerConnectionEvents(
        safeTenantId,
        sock,
        saveCreds,
        state
    );

    return connectionData;
}

/**
 * Returns the active connection or creates exactly one connection.
 */
async function getOrCreateConnection(tenantId) {
    const safeTenantId = assertValidTenantId(tenantId);

    const existing = connections.get(safeTenantId);

    if (existing) {
        return existing;
    }

    const pending =
        connectionCreationPromises.get(safeTenantId);

    if (pending) {
        return pending;
    }

    const creation = createTenantConnection(safeTenantId)
        .finally(() => {
            connectionCreationPromises.delete(safeTenantId);
        });

    connectionCreationPromises.set(
        safeTenantId,
        creation
    );

    return creation;
}

async function restoreSavedConnections() {
    const tenantDirs = fs
        .readdirSync(AUTH_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((tenantId) => {
            if (!tenantId || tenantId === '.gitkeep') {
                return false;
            }

            if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
                return false;
            }

            const tenantAuthPath = path.join(
                AUTH_DIR,
                tenantId
            );

            const credsPath = path.join(
                tenantAuthPath,
                'creds.json'
            );

            return fs.existsSync(credsPath);
        });

    const authRootCredsPath = path.join(
        AUTH_DIR,
        'creds.json'
    );

    if (fs.existsSync(authRootCredsPath)) {
        console.error(
            `[AUTH] Invalid AUTH_DIR configuration: ${AUTH_DIR} ` +
                'itself contains creds.json. AUTH_DIR must be the ' +
                'parent directory containing tenant folders.'
        );
    }

    if (!tenantDirs.length) {
        console.log(
            `No saved WhatsApp sessions found in ${AUTH_DIR}`
        );

        return;
    }

    console.log(
        `Restoring ${tenantDirs.length} saved WhatsApp session(s)`
    );

    for (const tenantId of tenantDirs) {
        try {
            await getOrCreateConnection(tenantId);

            console.log(`[${tenantId}] Restore requested`);
        } catch (error) {
            console.warn(
                `[${tenantId}] Failed to restore session:`,
                error.message || error
            );
        }
    }
}

async function resolveRecipientJid(sock, { phone, jid }) {
    const candidate = String(jid || phone || '').trim();

    if (!candidate) {
        throw new Error('Missing phone or JID');
    }

    /*
     * If the CRM already has the exact WhatsApp JID, preserve it.
     * This is important for replies to conversations using @lid.
     */
    if (
        candidate.endsWith('@lid') ||
        candidate.endsWith('@s.whatsapp.net')
    ) {
        return candidate;
    }

    if (
        candidate.endsWith('@g.us') ||
        candidate.endsWith('@newsletter') ||
        candidate.endsWith('@broadcast')
    ) {
        throw new Error(
            'Group, channel, and broadcast recipients are not allowed'
        );
    }

    let normalizedPhone = candidate.replace(
        /[^0-9]/g,
        ''
    );

    if (!normalizedPhone) {
        throw new Error(
            'Invalid phone number or WhatsApp JID'
        );
    }

    // Default 9-digit Spanish local numbers (starting with 6, 7, 8, 9) to Spain country code +34
    if (normalizedPhone.length === 9 && /^[6789]/.test(normalizedPhone)) {
        normalizedPhone = `34${normalizedPhone}`;
    }

    /*
     * The phone must include the country code.
     *
     * Spain example:
     * 34644123456
     *
     * Do not send a local number such as:
     * 644123456
     */
    const results = await sock.onWhatsApp(
        normalizedPhone
    );

    const existing = Array.isArray(results)
        ? results.find((item) => item?.exists && item?.jid)
        : null;

    if (!existing) {
        throw new Error(
            `Phone number +${normalizedPhone} is not registered ` +
                'on WhatsApp or could not be resolved'
        );
    }


    return existing.jid;
}

function getConnectionStatusResponse(conn) {
    const qrUrl = conn?.qr
        ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(conn.qr)}`
        : null;

    return {
        success: true,
        status: conn?.status || 'disconnected',
        me: conn?.me || null,
        createdAt: conn?.createdAt || null,
        qr: conn?.qr || null,
        qrUrl,
        reconnect: Boolean(conn?.reconnect),
        connection_state:
            conn?.connectionState || 'none',
        last_disconnect_reason:
            conn?.lastDisconnectReason || null,
    };
}

/**
 * GET /api/qr/:tenantId
 */
app.get('/api/qr/:tenantId', async (req, res) => {
    try {
        const tenantId = assertValidTenantId(
            req.params.tenantId
        );

        // Do not force recreation here.
        // Frontend polling must never delete or replace a socket.
        const conn = await getOrCreateConnection(tenantId);

        if (conn.status === 'connected') {
            return res.json({
                success: true,
                status: 'connected',
                message: 'Already connected',
                me: conn.me,
            });
        }

        if (conn.qr) {
            return res.json({
                success: true,
                status: 'awaiting_qr_scan',
                qr: conn.qr,
                qrUrl:
                    `https://api.qrserver.com/v1/create-qr-code/` +
                    `?size=300x300&data=${encodeURIComponent(conn.qr)}`,
            });
        }

        return res.json({
            success: true,
            status: conn.status || 'generating_qr',
            message: 'QR code generating, retry in 2 seconds',
        });
    } catch (error) {
        console.error('QR endpoint error:', error);

        res.status(500).json({
            error: error.message,
        });
    }
});

/**
 * GET /api/status/:tenantId
 */
app.get('/api/status/:tenantId', async (req, res) => {
    try {
        const tenantId = assertValidTenantId(
            req.params.tenantId
        );

        const conn = connections.get(tenantId);

        return res.json(
            getConnectionStatusResponse(conn)
        );
    } catch (error) {
        res.status(400).json({
            error: error.message,
        });
    }
});

/**
 * Converts a phone number into a WhatsApp JID.
 */
function phoneToJid(phone) {
    const normalizedPhone = String(phone || '').replace(
        /[^0-9]/g,
        ''
    );

    if (!normalizedPhone) {
        throw new Error('Invalid phone number');
    }

    return `${normalizedPhone}@s.whatsapp.net`;
}

/**
 * POST /api/send
 */
app.post('/api/send', async (req, res) => {
    try {
        const {
            tenantId,
            phone,
            jid,
            message,
        } = req.body;

        if (!tenantId || (!phone && !jid) || !message) {
            return res.status(400).json({
                error:
                    'Missing tenantId, phone/JID, or message',
            });
        }

        const safeTenantId = assertValidTenantId(tenantId);
        const conn = connections.get(safeTenantId);

        if (!conn || conn.status !== 'connected') {
            return res.status(503).json({
                error: 'Not connected to WhatsApp',
            });
        }

        const recipientJid = await resolveRecipientJid(
            conn.sock,
            {
                phone,
                jid,
            }
        );

        const sentMessage = await conn.sock.sendMessage(
            recipientJid,
            {
                text: String(message),
            }
        );

        const messageId = sentMessage?.key?.id;

        if (!messageId) {
            return res.status(502).json({
                error:
                    'WhatsApp did not return a message ID',
            });
        }

        console.log(
            `[${safeTenantId}] WhatsApp accepted outbound message`,
            {
                message_id: messageId,
                recipient: recipientJid,
            }
        );

        try {
            const delivery =
                await waitForMessageDelivery(
                    safeTenantId,
                    messageId,
                    20000
                );

            return res.json({
                success: true,
                recipient: recipientJid,
                message_id: messageId,
                delivery_status: delivery.status,
                delivered: delivery.delivered,
                read: delivery.read,
                message,
            });
        } catch (deliveryError) {
            /*
             * Do not automatically send again here.
             * The message may already have been accepted by WhatsApp,
             * but the receipt may have arrived late.
             */
            console.warn(
                `[${safeTenantId}] Delivery acknowledgement timeout`,
                {
                    message_id: messageId,
                    recipient: recipientJid,
                    error: deliveryError.message,
                }
            );

            return res.status(504).json({
                success: false,
                accepted_by_whatsapp: true,
                delivered: false,
                message_id: messageId,
                recipient: recipientJid,
                error: deliveryError.message,
            });
        }
    } catch (error) {
        console.error('Send error:', error);

        return res.status(422).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * POST /api/send-image
 */
app.post('/api/send-image', async (req, res) => {
    try {
        const {
            tenantId,
            phone,
            jid,
            imageUrl,
            caption,
        } = req.body;

        if (
            !tenantId ||
            (!phone && !jid) ||
            !imageUrl
        ) {
            return res.status(400).json({
                error:
                    'Missing tenantId, phone/JID, or imageUrl',
            });
        }

        const safeTenantId = assertValidTenantId(tenantId);
        const conn = connections.get(safeTenantId);

        if (!conn || conn.status !== 'connected') {
            return res.status(503).json({
                error: 'Not connected to WhatsApp',
            });
        }

        const recipientJid = await resolveRecipientJid(
            conn.sock,
            {
                phone,
                jid,
            }
        );

        const sentMessage = await conn.sock.sendMessage(
            recipientJid,
            {
                image: {
                    url: imageUrl,
                },
                caption: caption || '',
            }
        );

        const messageId = sentMessage?.key?.id;

        if (!messageId) {
            return res.status(502).json({
                error:
                    'WhatsApp did not return a message ID',
            });
        }

        console.log(
            `[${safeTenantId}] WhatsApp accepted outbound image`,
            {
                message_id: messageId,
                recipient: recipientJid,
            }
        );

        try {
            const delivery =
                await waitForMessageDelivery(
                    safeTenantId,
                    messageId,
                    30000
                );

            return res.json({
                success: true,
                recipient: recipientJid,
                message_id: messageId,
                delivery_status: delivery.status,
                delivered: delivery.delivered,
                read: delivery.read,
            });
        } catch (deliveryError) {
            /*
             * Do not automatically resend the image.
             * WhatsApp may already have accepted it.
             */
            console.warn(
                `[${safeTenantId}] Image delivery acknowledgement timeout`,
                {
                    message_id: messageId,
                    recipient: recipientJid,
                    error: deliveryError.message,
                }
            );

            return res.status(504).json({
                success: false,
                accepted_by_whatsapp: true,
                delivered: false,
                message_id: messageId,
                recipient: recipientJid,
                error: deliveryError.message,
            });
        }
    } catch (error) {
        console.error('Image send error:', error);

        return res.status(422).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * GET /api/contact/:tenantId/:jid
 *
 * Resolves a WhatsApp JID (including @lid) to contact info.
 * Uses sock.onWhatsApp() to get the canonical @s.whatsapp.net JID
 * which encodes the real phone number.
 *
 * Returns:
 *   { success: true, jid, phone, name }
 */
app.get('/api/contact/:tenantId/:jid', async (req, res) => {
    try {
        const tenantId = assertValidTenantId(req.params.tenantId);
        // jid may be the raw remote_jid (e.g. "218923106599111:27@lid")
        // or a plain numeric external_id (e.g. "34612345678")
        const rawJid = String(req.params.jid || '').trim();
        // senderPn is the @s.whatsapp.net form Baileys stores alongside @lid JIDs
        const senderPn = String(req.query.senderPn || '').trim() || null;

        if (!rawJid) {
            return res.status(400).json({ error: 'Missing jid' });
        }

        const conn = connections.get(tenantId);

        if (!conn || conn.status !== 'connected' || !conn.sock) {
            return res.status(503).json({ error: 'Not connected to WhatsApp' });
        }

        const resolvedPhone = await resolvePhoneFromJid(conn.sock, rawJid, senderPn);
        // Get push name from contact store if available
        let name = null;
        try {
            const contacts = conn.sock.store?.contacts || {};
            const contactEntry = contacts[rawJid];
            if (contactEntry) {
                name = contactEntry.name || contactEntry.notify || null;
            }
        } catch (_) {
            // store may not be available
        }

        return res.json({
            success: true,
            jid: rawJid,
            phone: resolvedPhone,
            name,
        });
    } catch (error) {
        console.error('Contact lookup error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/check-number/:tenantId/:phone
 * Checks if a phone number exists on WhatsApp using sock.onWhatsApp().
 */
app.get('/api/check-number/:tenantId/:phone', async (req, res) => {
    try {
        const tenantId = assertValidTenantId(req.params.tenantId);
        const rawPhone = String(req.params.phone || '').trim();

        if (!rawPhone) {
            return res.status(400).json({ error: 'Missing phone number' });
        }

        const conn = connections.get(tenantId);
        if (!conn || conn.status !== 'connected' || !conn.sock) {
            return res.status(530).json({ success: false, connected: false, error: 'WhatsApp service not connected' });
        }

        let digits = rawPhone.replace(/[^0-9]/g, '');
        if (digits.length === 9 && /^[6789]/.test(digits)) {
            digits = `34${digits}`;
        }

        const results = await conn.sock.onWhatsApp(digits);
        const existing = Array.isArray(results)
            ? results.find((item) => item?.exists && item?.jid)
            : null;

        if (existing) {
            return res.json({
                success: true,
                exists: true,
                jid: existing.jid,
                phone: `+${digits}`
            });
        } else {
            return res.json({
                success: true,
                exists: false,
                phone: `+${digits}`,
                message: `El número +${digits} no está registrado en WhatsApp.`
            });
        }
    } catch (error) {
        console.error('Check number error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});


/**
 * DELETE /api/session/:tenantId
 */
app.delete('/api/session/:tenantId', async (req, res) => {
    try {
        const tenantId = assertValidTenantId(
            req.params.tenantId
        );

        removeTenantSession(tenantId);

        console.log(`[${tenantId}] Session deleted`);

        return res.json({
            success: true,
            message: 'Session deleted',
        });
    } catch (error) {
        console.error('Session deletion error:', error);

        res.status(400).json({
            error: error.message,
        });
    }
});

/**
 * Start server.
 */
app.listen(PORT, () => {
    console.log(
        `WhatsApp service running on port ${PORT}`
    );

    console.log('Endpoints:');
    console.log('GET    /api/qr/:tenantId');
    console.log('GET    /api/status/:tenantId');
    console.log('GET    /api/contact/:tenantId/:jid');
    console.log('POST   /api/send');
    console.log('POST   /api/send-image');
    console.log('DELETE /api/session/:tenantId');
});

restoreSavedConnections().catch((error) => {
    console.error(
        'Failed to restore saved WhatsApp sessions:',
        error
    );
});