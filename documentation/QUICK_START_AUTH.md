# Quick Start: Admin Authentication

## 5-Minute Setup

### Step 1: Install Dependencies (1 min)
```bash
cd backend
pip install -r requirements.txt
```

### Step 2: Create Admin User (1 min)
```bash
python3 init_admin_user.py
```

Output:
```
✓ Admin user created successfully
  Username: likestudio
  Password: liegeJosemi2026

⚠️  IMPORTANT: Change the password after first login!
```

### Step 3: Start Backend (1 min)
```bash
python3 -m uvicorn app.main:app --reload
```

### Step 4: Update Admin Pages (2 min)

Add these scripts to your admin HTML pages (in order):

```html
<!-- At the end of <body>, before other scripts -->
<script src="../static/js/admin-auth.js"></script>
<script src="../static/js/admin-api.js"></script>
```

### Step 5: Update Admin JavaScript

Replace old fetch calls:

**Before:**
```javascript
fetch('/admin/clients')
  .then(r => r.json())
  .then(data => console.log(data));
```

**After:**
```javascript
adminApiGet('/admin/clients')
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

## Done! 🎉

Your admin panel is now secure. Try logging in:

1. Open admin page in browser
2. Login modal appears automatically
3. Enter: `likestudio` / `liegeJosemi2026`
4. You're in!

## Common Tasks

### Make API Calls
```javascript
// GET
adminApiGet('/admin/clients?limit=10')

// POST
adminApiPost('/admin/services', { name: 'New Service' })

// PUT
adminApiPut('/admin/services/1', { name: 'Updated' })

// DELETE
adminApiDelete('/admin/services/1')
```

### Check Authentication
```javascript
if (window.likestudioIsAuthenticated()) {
  console.log('User is logged in');
}
```

### Logout
```javascript
window.likestudioAdminLogout();
```

### Get Token
```javascript
var token = window.likestudioGetAuthToken();
console.log('Token:', token);
```

## Troubleshooting

### "Invalid credentials"
- Check username/password
- Verify admin user was created: `python3 init_admin_user.py`

### "Not authenticated"
- Make sure scripts are loaded: Check browser console
- Verify token exists: `window.likestudioGetAuthToken()`

### API returns 401
- Token expired (24 hours) - login again
- Token invalid - check browser console for errors

### CORS errors
- Backend not running? Start it: `python3 -m uvicorn app.main:app --reload`
- Wrong API_BASE? Check admin-auth.js line 7

## Next Steps

1. **Change Password**: Create new admin user with strong password
2. **Update All Pages**: Add scripts to all admin pages
3. **Test Everything**: Verify all admin features work
4. **Read Full Docs**: See `AUTHENTICATION.md` for details

## Files to Know

- `backend/app/services/auth_service.py` - Authentication logic
- `static/js/admin-auth.js` - Login system
- `static/js/admin-api.js` - API helper
- `backend/init_admin_user.py` - Create admin users
- `AUTHENTICATION.md` - Full documentation

## Security Reminder

✓ Credentials now validated on server
✓ Passwords hashed with bcrypt
✓ Tokens expire after 24 hours
✓ All admin endpoints protected
✓ No credentials in JavaScript

Your admin panel is now secure! 🔒
