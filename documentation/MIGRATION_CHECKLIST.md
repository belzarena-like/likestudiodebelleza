# Admin Authentication Migration Checklist

Use this checklist to migrate your admin pages to the new secure authentication system.

## Pre-Migration

- [ ] Read `QUICK_START_AUTH.md`
- [ ] Read `AUTHENTICATION.md`
- [ ] Backup current admin pages
- [ ] Test current admin functionality
- [ ] Install dependencies: `pip install -r requirements.txt`
- [ ] Create admin user: `python3 init_admin_user.py`
- [ ] Start backend: `python3 -m uvicorn app.main:app --reload`

## For Each Admin Page

### 1. Add Authentication Scripts

In the `<body>` tag, add these scripts **before** your page scripts:

```html
<!-- Authentication system -->
<script src="../static/js/admin-auth.js"></script>
<!-- API helper for authenticated requests -->
<script src="../static/js/admin-api.js"></script>
<!-- Your page scripts -->
<script src="./js/your-page.js"></script>
```

**Checklist:**
- [ ] Scripts added in correct order
- [ ] Scripts load without errors (check console)
- [ ] Login modal appears when not authenticated

### 2. Update API Calls

Find all `fetch()` calls to `/admin/*` endpoints and replace them.

**Pattern 1: Simple GET**

Before:
```javascript
fetch('/admin/clients')
  .then(r => r.json())
  .then(data => console.log(data));
```

After:
```javascript
adminApiGet('/admin/clients')
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

**Pattern 2: GET with Query Parameters**

Before:
```javascript
fetch('/admin/clients?limit=10&offset=0')
  .then(r => r.json())
  .then(data => console.log(data));
```

After:
```javascript
adminApiGet('/admin/clients?limit=10&offset=0')
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

**Pattern 3: POST**

Before:
```javascript
fetch('/admin/services', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'New Service' })
})
  .then(r => r.json())
  .then(data => console.log(data));
```

After:
```javascript
adminApiPost('/admin/services', { name: 'New Service' })
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

**Pattern 4: PUT**

Before:
```javascript
fetch('/admin/services/1', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Updated' })
})
  .then(r => r.json())
  .then(data => console.log(data));
```

After:
```javascript
adminApiPut('/admin/services/1', { name: 'Updated' })
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

**Pattern 5: DELETE**

Before:
```javascript
fetch('/admin/services/1', { method: 'DELETE' })
  .then(r => r.json())
  .then(data => console.log(data));
```

After:
```javascript
adminApiDelete('/admin/services/1')
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

**Checklist for each page:**
- [ ] All `/admin/*` fetch calls replaced
- [ ] Error handling added
- [ ] No hardcoded credentials in code
- [ ] Page tested in browser
- [ ] Console shows no errors

### 3. Update Error Handling

Add proper error handling for authentication failures:

```javascript
adminApiGet('/admin/clients')
  .then(data => {
    // Success
    console.log('Clients:', data);
  })
  .catch(error => {
    // Handle error
    if (error.message.includes('Session expired')) {
      console.log('Please log in again');
    } else {
      console.error('Error:', error.message);
    }
  });
```

**Checklist:**
- [ ] Error handling added to all API calls
- [ ] User-friendly error messages
- [ ] No sensitive data in error messages

### 4. Remove Old Authentication Code

Find and remove:
- [ ] Hardcoded username/password variables
- [ ] Old localStorage auth keys
- [ ] Old sessionStorage auth keys
- [ ] Old auth validation logic
- [ ] Old logout functions

Search for:
```javascript
// Remove these patterns:
var USERNAME = "...";
var PASSWORD = "...";
localStorage.getItem("likestudio_admin_auth");
sessionStorage.getItem("likestudio_admin_auth");
```

### 5. Test the Page

**Checklist:**
- [ ] Page loads without errors
- [ ] Login modal appears (if not logged in)
- [ ] Can log in with credentials
- [ ] API calls work after login
- [ ] Token is stored in localStorage
- [ ] Logout works
- [ ] Can log back in
- [ ] Page works after page refresh
- [ ] Token expires after 24 hours (or test with short expiry)

## Pages to Migrate

List all admin pages that need migration:

- [ ] admin/index.html
- [ ] admin/clients.html
- [ ] admin/sessions.html
- [ ] admin/appointments.html
- [ ] admin/services.html
- [ ] admin/consents.html
- [ ] admin/settings.html
- [ ] admin/payments.html
- [ ] admin/qr-codes.html
- [ ] admin/email-settings.html
- [ ] admin/working-hours.html
- [ ] _Other pages:_
  - [ ] 
  - [ ] 
  - [ ] 

## Testing

### Unit Tests

- [ ] Login with correct credentials works
- [ ] Login with wrong credentials fails
- [ ] Token is stored after login
- [ ] Token is included in API requests
- [ ] Expired token triggers logout
- [ ] Logout clears token

### Integration Tests

- [ ] All admin pages load
- [ ] All API calls work
- [ ] All CRUD operations work
- [ ] Error handling works
- [ ] Session persists on page refresh
- [ ] Session expires after 24 hours

### Security Tests

- [ ] Cannot access admin pages without login
- [ ] Cannot access admin API without token
- [ ] Invalid token returns 401
- [ ] Expired token returns 401
- [ ] No credentials in localStorage (except token)
- [ ] No credentials in browser console
- [ ] No credentials in network requests (except Authorization header)

## Deployment

- [ ] All pages migrated
- [ ] All tests passing
- [ ] Backend running with new auth
- [ ] Admin user created in production database
- [ ] HTTPS enabled (required for production)
- [ ] SECRET_KEY changed in production
- [ ] Admin password changed from default
- [ ] Backup of old code created
- [ ] Rollback plan documented

## Post-Migration

- [ ] Monitor for errors in production
- [ ] Check admin user logs
- [ ] Verify all admin features work
- [ ] Update team on new login process
- [ ] Document new admin procedures
- [ ] Schedule password change reminder
- [ ] Plan for 2FA implementation

## Rollback Plan

If something goes wrong:

1. [ ] Revert code to backup
2. [ ] Restart backend
3. [ ] Clear browser cache
4. [ ] Test old authentication
5. [ ] Document what went wrong
6. [ ] Plan fix

## Support

If you encounter issues:

1. Check browser console for errors
2. Check backend logs for errors
3. Verify admin user exists: `python3 init_admin_user.py`
4. Verify backend is running
5. Check network tab for API responses
6. Read `AUTHENTICATION.md` for details
7. Review `QUICK_START_AUTH.md` for setup

## Sign-Off

- [ ] All pages migrated
- [ ] All tests passing
- [ ] Team trained on new system
- [ ] Documentation updated
- [ ] Ready for production

**Migrated by:** ________________  
**Date:** ________________  
**Notes:** ________________
