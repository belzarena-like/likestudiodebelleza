FROM node:20-alpine AS deps

WORKDIR /app

COPY whatsapp-service/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund --loglevel=error

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001

RUN apk add --no-cache dumb-init \
    && addgroup -g 1001 -S app \
    && adduser -S -u 1001 -G app app

COPY --from=deps /app/node_modules ./node_modules
COPY whatsapp-service/index.js ./index.js

RUN mkdir -p /app/auth_sessions \
    && chown -R app:app /app

VOLUME ["/app/auth_sessions"]

USER app

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]