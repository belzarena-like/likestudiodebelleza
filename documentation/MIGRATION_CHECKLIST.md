# Migration Checklist

## Pre-Migration

- [ ] **Backup database**
  ```bash
  cp likestudio.db likestudio.db.backup
  ```

- [ ] **Review current environment variables**
  ```bash
  # Check these are set:
  echo $AWS_ACCESS_KEY_ID
  echo $AWS_SECRET_ACCESS_KEY
  echo $S3_TRAINING_BUCKET
  echo $ACADEMY_SECRET
  ```

- [ ] **Test current system**
  - [ ] Admin can upload videos
  - [ ] Students can login
  - [ ] Students can watch videos
  - [ ] All other endpoints work

- [ ] **Read documentation**
  - [ ] REFACTORING_SUMMARY.md
  - [ ] REFACTORING.md
  - [ ] ARCHITECTURE.md

## Migration Steps

- [ ] **Stop the server**
  ```bash
  # Kill the running uvicorn process
  pkill -f uvicorn
  ```

- [ ] **Run migration script**
  
  **Windows:**
  ```bash
  cd backend
  migrate_to_refactored.bat
  ```
  
  **Linux/Mac:**
  ```bash
  cd backend
  chmod +x migrate_to_refactored.sh
  ./migrate_to_refactored.sh
  ```

- [ ] **Verify files were created**
  ```bash
  ls -la app/services/
  ls -la app/controllers/
  ls -la app/main_old.py
  ls -la app/main.py
  ```

- [ ] **Start the server**
  ```bash
  cd backend
  uvicorn app.main:app --reload
  ```

- [ ] **Check server starts without errors**
  - Look for "Application startup complete"
  - No import errors
  - No syntax errors

## Post-Migration Testing

### Health Check
- [ ] `GET /health` returns `{"status": "ok"}`
  ```bash
  curl http://localhost:8000/health
  ```

### Admin Training Endpoints

- [ ] **List training sessions**
  ```bash
  curl http://localhost:8000/admin/training/sessions
  ```

- [ ] **Get upload URL**
  ```bash
  curl "http://localhost:8000/admin/training/videos/upload-url?filename=test.mp4"
  ```

- [ ] **List videos**
  ```bash
  curl http://localhost:8000/admin/training/videos
  ```

- [ ] **Create training session** (via admin UI)
  - Open admin/training.html
  - Click "Crear Curso"
  - Fill form and submit
  - Verify session appears in list

- [ ] **Upload video** (via admin UI)
  - Open admin/training.html
  - Go to "Videos" tab
  - Upload a test video
  - Verify video appears in list

- [ ] **Add video to session** (via admin UI)
  - Open a training session
  - Add a video from library
  - Verify video appears in session

- [ ] **Create user access** (via admin UI)
  - Open a training session
  - Go to "Usuarios" tab
  - Create a test user
  - Note username and password

### Student/Academy Endpoints

- [ ] **Student login**
  ```bash
  curl -X POST http://localhost:8000/academy/login \
    -F "username=testuser" \
    -F "password=testpass" \
    -F "session_id=1"
  ```
  - Should return token

- [ ] **Get session details** (with token from above)
  ```bash
  curl "http://localhost:8000/academy/session/1?token=YOUR_TOKEN"
  ```
  - Should return session with videos

- [ ] **Get video stream URL** (with token)
  ```bash
  curl "http://localhost:8000/academy/video/1/stream-url?token=YOUR_TOKEN"
  ```
  - Should return signed S3 URL
  - URL should start with `https://`
  - URL should contain `X-Amz-Signature`

- [ ] **Test video playback** (via academia.html)
  - Open academia.html
  - Login with test user
  - Click on a video
  - Verify video plays

### Other Endpoints (Regression Testing)

- [ ] **Clients**
  ```bash
  curl http://localhost:8000/admin/clients
  ```

- [ ] **Appointments**
  ```bash
  curl http://localhost:8000/admin/appointments
  ```

- [ ] **Services**
  ```bash
  curl http://localhost:8000/public/services
  ```

- [ ] **Consents**
  ```bash
  curl http://localhost:8000/admin/consents
  ```

## Verification

### Code Quality
- [ ] No Python syntax errors
- [ ] No import errors
- [ ] All services properly initialized
- [ ] All controllers properly registered

### Functionality
- [ ] All training endpoints work
- [ ] Signed URLs are generated correctly
- [ ] Token authentication works
- [ ] Video access control works
- [ ] View logging works
- [ ] All other endpoints still work

### Security
- [ ] Signed URLs expire after configured time
- [ ] Invalid tokens are rejected
- [ ] Users can only access their session's videos
- [ ] Password hashing works (bcrypt if passlib installed)

### Performance
- [ ] Server starts quickly
- [ ] Endpoints respond quickly
- [ ] No memory leaks
- [ ] Database queries are efficient

## Rollback Plan (If Needed)

If something goes wrong:

1. **Stop the server**
   ```bash
   pkill -f uvicorn
   ```

2. **Restore original main.py**
   ```bash
   cd backend/app
   cp main_old.py main.py
   ```

3. **Restart server**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

4. **Verify system works**
   - Test critical endpoints
   - Check logs for errors

5. **Report issues**
   - Document what went wrong
   - Check error logs
   - Review REFACTORING.md for troubleshooting

## Success Criteria

✅ Migration is successful if:

1. Server starts without errors
2. All training endpoints work
3. Signed S3 URLs are generated
4. Students can login and watch videos
5. All other endpoints still work
6. No performance degradation
7. No security issues

## Post-Migration Cleanup (Optional)

After confirming everything works for a few days:

- [ ] **Remove old backup** (if confident)
  ```bash
  rm backend/app/main_old.py
  ```

- [ ] **Update documentation**
  - Update README if needed
  - Document any custom changes

- [ ] **Monitor logs**
  - Check for any errors
  - Monitor performance
  - Track video views

## Next Steps

After successful migration:

1. **Consider adding tests**
   - Unit tests for services
   - Integration tests for controllers
   - End-to-end tests for critical flows

2. **Consider adding more controllers**
   - Client controller
   - Appointment controller
   - Consent controller

3. **Consider adding monitoring**
   - Application metrics
   - Error tracking
   - Performance monitoring

4. **Consider adding caching**
   - Redis for session data
   - Cache frequently accessed data

## Support

If you need help:

1. Check REFACTORING.md for detailed docs
2. Check ARCHITECTURE.md for system design
3. Check server logs for errors
4. Verify environment variables
5. Test with curl commands above

## Notes

- Migration is non-destructive (original file is backed up)
- All changes are additive (no database migrations needed)
- 100% API compatible (no frontend changes needed)
- Can rollback at any time

---

**Date Migrated**: _________________

**Migrated By**: _________________

**Issues Encountered**: _________________

**Resolution**: _________________
