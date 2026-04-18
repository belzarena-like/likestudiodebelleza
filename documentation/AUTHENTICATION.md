# Admin Authentication System

## Overview

The admin panel now uses a secure server-side authentication system with JWT tokens. This prevents unauthorized access even if someone bypasses the frontend authentication.

### Key Security Features

1. **Server-Side Validation**: All admin endpoints require a valid JWT token
2. **Password Hashing**: Passwords are hashed using bcrypt (never stored in plain text)
3. **Token Expiration**: Tokens expire after 24 hours
4. **No Hardcoded Credentials**: Credentials are stored in the database, not in JavaScript

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Initialize Admin User

Run the initialization script to create the first admin user:

```bash
python3 init_admin_user.py
```

This creates an admin user with:
- Username: `likestudio`
- Password: `liegeJosemi2026`

**⚠️ IMPORTANT**: Change this password immediately after first login!

### 3. Update Admin Pages

Make sure your admin HTML pages include the authentication scripts in this order:

```html
<!-- Authentication system -->
<script src="../static/js/admin-auth.js"></script>
<!-- API helper for authenticated requests -->
<script src="../static/js/admin-api.js"></script>
<!-- Your admin page scripts -->
<script src="./js/your-admin-page.js"></script>
```

## How It Works

### Login Flow

1. User enters credentials in the login modal
2. Frontend sends credentials to `/admin/login` endpoint
3. Backend validates credentials against database
4. Backend returns JWT token with 24-hour expiration
5. Frontend stores token in localStorage
6. Token is automatically included in all subsequent requests

### Protected Endpoints

All `/admin/*` endpoints now require authentication:

```javascript
// Example: Making an authenticated API call
adminApiGet('/admin/clients?limit=10')
  .then(function(data) {
    console.log('Clients:', data);
  })
  .catch(function(error) {
    console.error('Error:', error);
  });
```

### Token Verification

The backend verifies tokens on every admin request:

```
GET /admin/clients
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

If the token is invalid or expired, the request returns 401 Unauthorized and the user is logged out.

## API Endpoints

### Authentication Endpoints

#### POST /admin/login
Login with username and password.

**Request:**
```json
{
  "username": "likestudio",
  "password": "liegeJosemi2026"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

#### GET /admin/verify-token
Verify that the current token is valid.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "valid": true,
  "username": "likestudio",
  "expires_at": null
}
```

## Frontend API Helpers

### Available Functions

```javascript
// Get authentication token
var token = window.likestudioGetAuthToken();

// Check if user is authenticated
if (window.likestudioIsAuthenticated()) {
  // User is logged in
}

// Logout
window.likestudioAdminLogout();

// Make authenticated API calls
adminApiGet('/admin/clients')
adminApiPost('/admin/services', { name: 'New Service' })
adminApiPut('/admin/services/1', { name: 'Updated Service' })
adminApiDelete('/admin/services/1')
```

## Updating Admin Pages

### Before (Old Way - Insecure)

```javascript
// ❌ DON'T DO THIS - Credentials in JavaScript!
var USERNAME = "likestudio";
var PASSWORD = "liegeJosemi2026";

fetch('/admin/clients')
  .then(r => r.json())
  .then(data => console.log(data));
```

### After (New Way - Secure)

```javascript
// ✓ DO THIS - Use authenticated API calls
adminApiGet('/admin/clients')
  .then(function(data) {
    console.log('Clients:', data);
  })
  .catch(function(error) {
    console.error('Error:', error);
  });
```

## Database Schema

### admin_users Table

```sql
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Managing Admin Users

### Create New Admin User

```python
from app.database import SessionLocal
from app.models import AdminUser
from app.services.auth_service import hash_password

db = SessionLocal()
new_admin = AdminUser(
    username="newadmin",
    password_hash=hash_password("secure_password_here"),
    full_name="New Admin Name",
    email="admin@example.com",
    is_active=True
)
db.add(new_admin)
db.commit()
```

### Deactivate Admin User

```python
admin = db.query(AdminUser).filter(AdminUser.username == "username").first()
admin.is_active = False
db.commit()
```

### Change Admin Password

```python
from app.services.auth_service import hash_password

admin = db.query(AdminUser).filter(AdminUser.username == "username").first()
admin.password_hash = hash_password("new_password")
db.commit()
```

## Security Best Practices

1. **Change Default Password**: Change the default admin password immediately
2. **Use Strong Passwords**: Require passwords with at least 8 characters
3. **HTTPS Only**: Always use HTTPS in production
4. **Token Rotation**: Consider implementing token refresh for long sessions
5. **Audit Logging**: Log all admin actions for security auditing
6. **Rate Limiting**: Implement rate limiting on login endpoint to prevent brute force

## Troubleshooting

### "Invalid credentials" Error

- Verify username and password are correct
- Check that the admin user exists in the database
- Ensure the password was hashed correctly

### "Session expired" Error

- Token has expired (24 hours)
- User needs to log in again
- This is normal behavior

### "Not authenticated" Error

- Token is missing or invalid
- User needs to log in
- Check that auth scripts are loaded before API calls

### CORS Errors

If you see CORS errors in the browser console:

1. Ensure the backend is running
2. Check that API_BASE in admin-auth.js points to the correct server
3. Verify CORS middleware is configured in FastAPI

## Migration from Old System

If you're migrating from the old hardcoded credentials system:

1. Run `init_admin_user.py` to create the database user
2. Update all admin HTML pages to include the new scripts
3. Update all admin JavaScript to use `adminApiGet/Post/Put/Delete` instead of direct fetch
4. Test all admin functionality
5. Remove old hardcoded credentials from JavaScript files

## Support

For issues or questions about the authentication system, check:

1. Backend logs: `python3 -m app.main` (with debug output)
2. Browser console: Check for JavaScript errors
3. Network tab: Verify API requests and responses
4. Database: Verify admin_users table exists and has data
