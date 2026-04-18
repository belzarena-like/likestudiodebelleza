# Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: "Invalid credentials" Error

**Symptoms:**
- Login modal appears
- Enter credentials
- Error: "Credenciales incorrectas o error de conexion."

**Possible Causes:**
1. Admin user not created
2. Wrong username/password
3. Backend not running
4. Database connection issue

**Solutions:**

**Step 1: Verify admin user exists**
```bash
cd backend
python3 init_admin_user.py
```

Expected output:
```
✓ Admin user created successfully
  Username: likestudio
  Password: liegeJosemi2026
```

**Step 2: Verify backend is running**
```bash
python3 -m uvicorn app.main:app --reload
```

Should see:
```
Uvicorn running on http://127.0.0.1:8000
```

**Step 3: Test login endpoint directly**
```bash
curl -X POST http://localhost:8000/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"likestudio","password":"liegeJosemi2026"}'
```

Should return:
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

**Step 4: Check browser console**
- Open browser DevTools (F12)
- Go to Console tab
- Look for error messages
- Check Network tab for API responses

---

### Issue 2: "Not authenticated" Error

**Symptoms:**
- Page doesn't load
- Console shows: "Not authenticated"
- Login modal doesn't appear

**Possible Causes:**
1. Scripts not loaded
2. Scripts loaded in wrong order
3. JavaScript error in scripts

**Solutions:**

**Step 1: Verify scripts are loaded**
```javascript
// Open browser console and run:
console.log(typeof window.likestudioGetAuthToken);
console.log(typeof window.adminApiGet);
```

Should show: `function` for both

If shows `undefined`, scripts not loaded.

**Step 2: Check script order**
In your HTML, verify this order:
```html
<script src="../static/js/admin-auth.js"></script>
<script src="../static/js/admin-api.js"></script>
<script src="./js/your-page.js"></script>
```

**Step 3: Check for JavaScript errors**
- Open DevTools (F12)
- Go to Console tab
- Look for red error messages
- Fix any errors

**Step 4: Verify script paths**
- Check that paths are correct
- Verify files exist at those paths
- Check file permissions

---

### Issue 3: API Returns 401 Unauthorized

**Symptoms:**
- Login works
- Page loads
- API calls fail with 401
- Console shows: "Session expired"

**Possible Causes:**
1. Token expired (24 hours)
2. Token invalid
3. Token not being sent
4. Backend can't verify token

**Solutions:**

**Step 1: Check token in localStorage**
```javascript
// Open browser console and run:
var session = JSON.parse(localStorage.getItem('likestudio_admin_auth_v3'));
console.log('Token:', session.token);
console.log('Expires at:', new Date(session.expires_at));
console.log('Now:', new Date());
```

**Step 2: Check if token is expired**
```javascript
var session = JSON.parse(localStorage.getItem('likestudio_admin_auth_v3'));
var now = Date.now();
var expired = session.expires_at <= now;
console.log('Token expired:', expired);
```

If expired, login again.

**Step 3: Check if token is being sent**
- Open DevTools (F12)
- Go to Network tab
- Make an API call
- Click on the request
- Go to Headers tab
- Look for: `Authorization: Bearer eyJ...`

If not present, check admin-api.js

**Step 4: Verify backend can verify token**
```bash
# Get token from login
TOKEN=$(curl -s -X POST http://localhost:8000/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"likestudio","password":"liegeJosemi2026"}' \
  | jq -r '.access_token')

# Test token
curl -X GET http://localhost:8000/admin/verify-token \
  -H "Authorization: Bearer $TOKEN"
```

Should return:
```json
{
  "valid": true,
  "username": "likestudio",
  "expires_at": null
}
```

---

### Issue 4: CORS Errors

**Symptoms:**
- Browser console shows CORS error
- API calls fail
- Error mentions "Access-Control-Allow-Origin"

**Possible Causes:**
1. Backend not running
2. Wrong API_BASE URL
3. CORS not configured

**Solutions:**

**Step 1: Verify backend is running**
```bash
python3 -m uvicorn app.main:app --reload
```

**Step 2: Check API_BASE in admin-auth.js**
```javascript
// Line 7 in admin-auth.js
var API_BASE = window.location.origin.includes('localhost') 
  ? 'http://localhost:8000'
  : window.location.origin;

console.log('API_BASE:', API_BASE);
```

Should match your backend URL.

**Step 3: Test CORS directly**
```bash
curl -X GET http://localhost:8000/health
```

Should return:
```json
{"status": "ok"}
```

**Step 4: Check backend CORS configuration**
In `app/main.py`, verify:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### Issue 5: Page Loads But No Login Modal

**Symptoms:**
- Page loads normally
- No login modal appears
- Can't access admin features

**Possible Causes:**
1. Already logged in (token in localStorage)
2. admin-auth.js not loaded
3. Token is valid but user doesn't exist

**Solutions:**

**Step 1: Check if already logged in**
```javascript
console.log(window.likestudioIsAuthenticated());
```

If `true`, you're logged in. Try accessing admin features.

**Step 2: Clear localStorage and reload**
```javascript
localStorage.removeItem('likestudio_admin_auth_v3');
location.reload();
```

**Step 3: Verify admin-auth.js is loaded**
```javascript
console.log(typeof window.likestudioAdminLogout);
```

Should show `function`.

**Step 4: Check browser console for errors**
- Open DevTools (F12)
- Go to Console tab
- Look for red error messages

---

### Issue 6: Can't Update Admin Pages

**Symptoms:**
- Updated JavaScript to use adminApiGet
- Still getting errors
- API calls not working

**Possible Causes:**
1. Syntax errors in JavaScript
2. Wrong endpoint paths
3. Missing error handling
4. Old fetch calls still present

**Solutions:**

**Step 1: Check for syntax errors**
```javascript
// Open browser console
// Look for red error messages
// Check line numbers
```

**Step 2: Verify endpoint paths**
```javascript
// Correct format:
adminApiGet('/admin/clients')

// Wrong formats:
adminApiGet('admin/clients')  // Missing /
adminApiGet('/admin/clients/')  // Extra /
adminApiGet('/admin/clients?')  // Wrong query format
```

**Step 3: Add error handling**
```javascript
adminApiGet('/admin/clients')
  .then(data => {
    console.log('Success:', data);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
```

**Step 4: Search for old fetch calls**
```bash
# In your JavaScript files, search for:
grep -r "fetch('/admin" .
```

Replace all with adminApiGet/Post/Put/Delete.

---

### Issue 7: Database Errors

**Symptoms:**
- Backend crashes
- Error mentions "admin_users table"
- Error mentions "database"

**Possible Causes:**
1. Migration not run
2. Database file corrupted
3. Permission issues

**Solutions:**

**Step 1: Run migration**
```bash
cd backend
python3 -c "from app.database import Base, engine; Base.metadata.create_all(bind=engine)"
```

**Step 2: Verify admin_users table exists**
```bash
# For SQLite
sqlite3 likestudio.db ".tables"

# Should show: admin_users among other tables
```

**Step 3: Check table structure**
```bash
sqlite3 likestudio.db ".schema admin_users"
```

Should show:
```sql
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  ...
);
```

**Step 4: Recreate database if corrupted**
```bash
# Backup old database
mv likestudio.db likestudio.db.backup

# Create new database
python3 init_admin_user.py
```

---

### Issue 8: Password Not Working

**Symptoms:**
- Login fails with correct username
- Error: "Credenciales incorrectas"
- Can't change password

**Possible Causes:**
1. Password changed but not hashed
2. Wrong password stored
3. User deactivated

**Solutions:**

**Step 1: Reset password**
```python
from app.database import SessionLocal
from app.models import AdminUser
from app.services.auth_service import hash_password

db = SessionLocal()
admin = db.query(AdminUser).filter(AdminUser.username == "likestudio").first()
admin.password_hash = hash_password("liegeJosemi2026")
db.commit()
print("Password reset to default")
```

**Step 2: Check if user is active**
```python
from app.database import SessionLocal
from app.models import AdminUser

db = SessionLocal()
admin = db.query(AdminUser).filter(AdminUser.username == "likestudio").first()
print(f"User active: {admin.is_active}")

if not admin.is_active:
    admin.is_active = True
    db.commit()
    print("User activated")
```

**Step 3: Create new admin user**
```bash
python3 init_admin_user.py
```

---

### Issue 9: Token Expires Too Quickly

**Symptoms:**
- Get logged out after short time
- Token expires before 24 hours
- Need to login frequently

**Possible Causes:**
1. Token expiry set too short
2. System clock wrong
3. Browser clearing localStorage

**Solutions:**

**Step 1: Check token expiry**
```javascript
var session = JSON.parse(localStorage.getItem('likestudio_admin_auth_v3'));
var expiresIn = (session.expires_at - Date.now()) / 1000 / 60 / 60;
console.log('Token expires in hours:', expiresIn);
```

Should be close to 24.

**Step 2: Check system clock**
```bash
date
```

Should show correct time.

**Step 3: Check browser settings**
- Verify localStorage is not cleared on exit
- Check privacy settings
- Try different browser

**Step 4: Increase token expiry (if needed)**
In `app/services/auth_service.py`:
```python
TOKEN_EXPIRE_HOURS = 24  # Change this value
```

---

### Issue 10: Multiple Admin Users

**Symptoms:**
- Want to create more admin users
- Don't know how
- Need different permissions

**Solutions:**

**Create new admin user:**
```python
from app.database import SessionLocal
from app.models import AdminUser
from app.services.auth_service import hash_password

db = SessionLocal()
new_admin = AdminUser(
    username="newadmin",
    password_hash=hash_password("secure_password"),
    full_name="New Admin Name",
    email="admin@example.com",
    is_active=True
)
db.add(new_admin)
db.commit()
print("New admin user created")
```

**Deactivate admin user:**
```python
admin = db.query(AdminUser).filter(AdminUser.username == "oldadmin").first()
admin.is_active = False
db.commit()
print("Admin user deactivated")
```

**Change admin password:**
```python
admin = db.query(AdminUser).filter(AdminUser.username == "likestudio").first()
admin.password_hash = hash_password("new_password")
db.commit()
print("Password changed")
```

---

## Debug Checklist

When something doesn't work:

- [ ] Check browser console for errors (F12)
- [ ] Check backend logs for errors
- [ ] Verify backend is running
- [ ] Verify admin user exists
- [ ] Verify token in localStorage
- [ ] Verify scripts are loaded
- [ ] Verify script order
- [ ] Check Network tab for API responses
- [ ] Test API endpoint directly with curl
- [ ] Check database for admin_users table
- [ ] Verify CORS is configured
- [ ] Check file permissions
- [ ] Try clearing cache and reloading

## Getting Help

If you can't solve the issue:

1. **Check Documentation**
   - QUICK_START_AUTH.md
   - AUTHENTICATION.md
   - ARCHITECTURE.md

2. **Check Logs**
   - Browser console (F12)
   - Backend terminal output
   - Database logs

3. **Test Endpoints**
   - Use curl to test API
   - Verify responses
   - Check status codes

4. **Verify Setup**
   - Run init_admin_user.py again
   - Restart backend
   - Clear browser cache
   - Try different browser

5. **Review Code**
   - Check admin-auth.js
   - Check admin-api.js
   - Check your page JavaScript
   - Check backend main.py

## Performance Issues

**Slow login:**
- Check network latency
- Verify backend performance
- Check database performance

**Slow API calls:**
- Check network latency
- Verify backend performance
- Check database queries
- Add caching if needed

**High memory usage:**
- Check for memory leaks
- Verify token cleanup
- Check localStorage size

## Security Issues

**Suspicious activity:**
- Check admin_users table
- Review recent logins
- Check for unauthorized users
- Deactivate suspicious accounts

**Compromised credentials:**
- Change password immediately
- Create new admin user
- Deactivate old user
- Review access logs

**Token leakage:**
- Check browser console
- Check network requests
- Verify HTTPS in production
- Check localStorage access

## Still Need Help?

1. Review the documentation files
2. Check the code comments
3. Test with curl
4. Check browser DevTools
5. Review backend logs
6. Verify database
7. Try a fresh setup
