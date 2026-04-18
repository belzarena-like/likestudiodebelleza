# Admin Authentication Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Frontend)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  admin-auth.js                                           │   │
│  │  ├─ Login Modal                                          │   │
│  │  ├─ Token Storage (localStorage)                         │   │
│  │  ├─ Session Management                                   │   │
│  │  └─ Automatic Logout                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  admin-api.js                                            │   │
│  │  ├─ adminApiGet()                                        │   │
│  │  ├─ adminApiPost()                                       │   │
│  │  ├─ adminApiPut()                                        │   │
│  │  ├─ adminApiDelete()                                     │   │
│  │  └─ Token Injection                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Admin Pages (clients.html, services.html, etc.)         │   │
│  │  ├─ Page-specific JavaScript                             │   │
│  │  ├─ Uses adminApiGet/Post/Put/Delete                     │   │
│  │  └─ Displays data from API                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↕
                    HTTP/HTTPS with JWT
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Authentication Endpoints                                │   │
│  │  ├─ POST /admin/login                                    │   │
│  │  │  └─ Returns JWT token                                 │   │
│  │  └─ GET /admin/verify-token                              │   │
│  │     └─ Verifies token validity                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Authentication Middleware                               │   │
│  │  ├─ get_admin_user() dependency                          │   │
│  │  ├─ Extracts token from Authorization header             │   │
│  │  ├─ Validates token signature                            │   │
│  │  ├─ Checks token expiration                              │   │
│  │  └─ Returns 401 if invalid                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Protected Admin Endpoints (40+)                         │   │
│  │  ├─ GET /admin/clients                                   │   │
│  │  ├─ POST /admin/services                                 │   │
│  │  ├─ PUT /admin/payments/{id}                             │   │
│  │  ├─ DELETE /admin/qr-codes/{id}                          │   │
│  │  └─ ... (all require valid token)                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Authentication Service                                  │   │
│  │  ├─ hash_password()                                      │   │
│  │  ├─ verify_password()                                    │   │
│  │  ├─ create_access_token()                                │   │
│  │  ├─ verify_token()                                       │   │
│  │  └─ authenticate_user()                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Database Layer                                          │   │
│  │  ├─ admin_users table                                    │   │
│  │  │  ├─ id (primary key)                                  │   │
│  │  │  ├─ username (unique)                                 │   │
│  │  │  ├─ password_hash (bcrypt)                            │   │
│  │  │  ├─ full_name                                         │   │
│  │  │  ├─ email                                             │   │
│  │  │  ├─ is_active                                         │   │
│  │  │  ├─ created_at                                        │   │
│  │  │  └─ updated_at                                        │   │
│  │  └─ Other tables (clients, services, etc.)               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Authentication Flow

### Login Flow

```
User Opens Admin Page
        ↓
admin-auth.js checks localStorage for token
        ↓
Token exists and valid?
    ├─ YES → Load page normally
    └─ NO → Show login modal
        ↓
User enters credentials
        ↓
admin-auth.js sends POST /admin/login
        ↓
Backend validates credentials
        ↓
Credentials valid?
    ├─ YES → Generate JWT token
    │        ↓
    │        Return token + expiry
    │        ↓
    │        admin-auth.js stores in localStorage
    │        ↓
    │        Hide modal, load page
    │
    └─ NO → Return 401 Unauthorized
            ↓
            Show error message
            ↓
            User tries again
```

### API Request Flow

```
Admin page calls adminApiGet('/admin/clients')
        ↓
admin-api.js gets token from localStorage
        ↓
admin-api.js adds Authorization header
        ↓
fetch() sends request with header:
    Authorization: Bearer <token>
        ↓
Backend receives request
        ↓
get_admin_user() dependency extracts token
        ↓
verify_token() validates token
        ↓
Token valid?
    ├─ YES → Extract username
    │        ↓
    │        Query admin_users table
    │        ↓
    │        User active?
    │            ├─ YES → Execute endpoint
    │            │        ↓
    │            │        Return data
    │            │        ↓
    │            │        admin-api.js resolves promise
    │            │        ↓
    │            │        Page displays data
    │            │
    │            └─ NO → Return 401
    │
    └─ NO → Return 401 Unauthorized
            ↓
            admin-api.js catches error
            ↓
            Call window.likestudioAdminLogout()
            ↓
            Clear localStorage
            ↓
            Reload page
            ↓
            Show login modal
```

## Token Structure

### JWT Token Format

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiJsaWtlc3R1ZGlvIiwiZXhwIjoxNzA0NjcyMDAwLCJpYXQiOjE3MDQ1ODU2MDB9.
abcdef123456...

Header:
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload:
{
  "sub": "likestudio",      // username
  "exp": 1704672000,        // expiration timestamp
  "iat": 1704585600         // issued at timestamp
}

Signature:
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  SECRET_KEY
)
```

## Data Flow Diagram

### Login Request

```
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ User enters: likestudio / liegeJosemi2026               │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    POST /admin/login
                    Content-Type: application/json
                    {
                      "username": "likestudio",
                      "password": "liegeJosemi2026"
                    }
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. Query admin_users WHERE username = "likestudio"     │ │
│ │ 2. Get password_hash from database                      │ │
│ │ 3. verify_password(input, hash)                         │ │
│ │ 4. If valid: create_access_token("likestudio")          │ │
│ │ 5. Return token + expiry                                │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    200 OK
                    {
                      "access_token": "eyJ...",
                      "token_type": "bearer",
                      "expires_in": 86400
                    }
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ localStorage.setItem("likestudio_admin_auth_v3", {     │ │
│ │   token: "eyJ...",                                      │ │
│ │   expires_at: now + 86400000,                           │ │
│ │   created_at: now                                       │ │
│ │ })                                                      │ │
│ │ Hide modal, load page                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Protected API Request

```
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ adminApiGet('/admin/clients')                           │ │
│ │ ├─ Get token from localStorage                          │ │
│ │ ├─ Add Authorization header                             │ │
│ │ └─ Send request                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    GET /admin/clients
                    Authorization: Bearer eyJ...
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ get_admin_user() dependency:                            │ │
│ │ 1. Extract token from Authorization header              │ │
│ │ 2. verify_token(token)                                  │ │
│ │ 3. If valid: extract username from payload              │ │
│ │ 4. Query admin_users WHERE username = extracted         │ │
│ │ 5. If user exists and is_active: proceed                │ │
│ │ 6. If not: raise HTTPException(401)                     │ │
│ │                                                         │ │
│ │ admin_search_clients():                                 │ │
│ │ 1. Query clients table                                  │ │
│ │ 2. Return results                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    200 OK
                    {
                      "items": [...],
                      "total": 42,
                      "limit": 200,
                      "offset": 0
                    }
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ adminApiGet() resolves promise                          │ │
│ │ Page displays clients                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Security Layers

```
Layer 1: Frontend
├─ Login modal blocks page access
├─ Token stored in localStorage
└─ Token included in all requests

Layer 2: Transport
├─ HTTPS (required in production)
├─ Authorization header (not URL parameter)
└─ No credentials in request body

Layer 3: Backend
├─ Token signature verification
├─ Token expiration check
├─ User existence verification
├─ User active status check
└─ Endpoint-level access control

Layer 4: Database
├─ Password hashing (bcrypt)
├─ No plain text passwords
├─ User deactivation support
└─ Audit trail (can be added)
```

## Component Interactions

```
┌──────────────────┐
│  admin-auth.js   │
│  (Login System)  │
└────────┬─────────┘
         │
         ├─ Calls: POST /admin/login
         │
         ├─ Stores: Token in localStorage
         │
         └─ Provides: Global functions
            ├─ likestudioGetAuthToken()
            ├─ likestudioIsAuthenticated()
            └─ likestudioAdminLogout()

┌──────────────────┐
│  admin-api.js    │
│  (API Helper)    │
└────────┬─────────┘
         │
         ├─ Uses: likestudioGetAuthToken()
         │
         ├─ Calls: adminApiGet/Post/Put/Delete()
         │
         ├─ Adds: Authorization header
         │
         └─ Handles: 401 responses
            └─ Calls: likestudioAdminLogout()

┌──────────────────┐
│  Admin Pages     │
│  (clients.html)  │
└────────┬─────────┘
         │
         ├─ Uses: adminApiGet/Post/Put/Delete()
         │
         ├─ Displays: Data from API
         │
         └─ Handles: Errors from API

┌──────────────────┐
│  Backend API     │
│  (FastAPI)       │
└────────┬─────────┘
         │
         ├─ Endpoint: POST /admin/login
         │  └─ Returns: JWT token
         │
         ├─ Middleware: get_admin_user()
         │  └─ Validates: Token
         │
         └─ Endpoints: GET /admin/*
            └─ Requires: Valid token
```

## Error Handling Flow

```
API Call Fails
        ↓
adminApiCall() catches error
        ↓
Check response status
        ↓
Is it 401?
    ├─ YES → Token invalid/expired
    │        ↓
    │        Call likestudioAdminLogout()
    │        ↓
    │        Clear localStorage
    │        ↓
    │        Reload page
    │        ↓
    │        Show login modal
    │
    └─ NO → Other error
            ↓
            Extract error message
            ↓
            Reject promise
            ↓
            Page handles error
            ↓
            Show error to user
```

## Deployment Architecture

```
Production Environment
├─ HTTPS (required)
├─ Backend Server
│  ├─ FastAPI app
│  ├─ SQLite/PostgreSQL database
│  ├─ admin_users table
│  └─ Other tables
├─ Frontend Server
│  ├─ Static HTML pages
│  ├─ admin-auth.js
│  ├─ admin-api.js
│  └─ Page-specific JS
└─ Environment Variables
   ├─ SECRET_KEY (for JWT signing)
   ├─ DATABASE_URL
   └─ CORS_ORIGINS
```

This architecture ensures:
- ✅ Security at multiple layers
- ✅ Clear separation of concerns
- ✅ Easy to test and debug
- ✅ Scalable to multiple servers
- ✅ Easy to add features (2FA, audit logging, etc.)
