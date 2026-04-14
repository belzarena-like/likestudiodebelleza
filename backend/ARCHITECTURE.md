# Backend Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Admin)                         │
│                    (training.html + training.js)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP/REST API
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Application                         │
│                         (main.py)                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Controllers Layer                            │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │     training_controller.py                         │  │  │
│  │  │  - Admin endpoints (/admin/training/*)             │  │  │
│  │  │  - Public endpoints (/academy/*)                   │  │  │
│  │  │  - Request validation                              │  │  │
│  │  │  - Response formatting                             │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             │ Calls                              │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Services Layer                               │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────┐ │  │
│  │  │ training_      │  │ auth_          │  │ s3_        │ │  │
│  │  │ service.py     │  │ service.py     │  │ service.py │ │  │
│  │  │                │  │                │  │            │ │  │
│  │  │ - Sessions     │  │ - Hash pwd     │  │ - Upload   │ │  │
│  │  │ - Videos       │  │ - Verify pwd   │  │ - Download │ │  │
│  │  │ - User access  │  │ - Tokens       │  │ - Delete   │ │  │
│  │  │ - View logs    │  │ - Verify token │  │ - Signed   │ │  │
│  │  │                │  │                │  │   URLs     │ │  │
│  │  └────────────────┘  └────────────────┘  └────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             │ Uses                               │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Data Layer                                   │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │  │
│  │  │ models.py  │  │ schemas.py │  │ crud.py            │ │  │
│  │  │            │  │            │  │                    │ │  │
│  │  │ - ORM      │  │ - Pydantic │  │ - DB operations    │ │  │
│  │  │ - Tables   │  │ - Validation│  │ - Queries         │ │  │
│  │  └────────────┘  └────────────┘  └────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Database       │
                    │   (SQLite/       │
                    │   PostgreSQL)    │
                    └──────────────────┘

                              │
                              │ (S3 Service)
                              ▼
                    ┌──────────────────┐
                    │   AWS S3         │
                    │   (Video Files)  │
                    └──────────────────┘
```

## Request Flow Examples

### Example 1: Admin Uploads Video

```
1. Admin → POST /admin/training/videos/upload-url
   ↓
2. training_controller.get_upload_url()
   ↓
3. s3_service.generate_upload_url()
   ↓
4. Returns: {upload_url, s3_key, s3_bucket}
   ↓
5. Admin uploads directly to S3 using signed URL
   ↓
6. Admin → POST /admin/training/videos (with metadata)
   ↓
7. training_controller.create_video_record()
   ↓
8. training_service.create_video()
   ↓
9. Database: INSERT INTO training_videos
   ↓
10. Returns: Video record
```

### Example 2: Student Watches Video

```
1. Student → POST /academy/login
   ↓
2. training_controller.academy_login()
   ↓
3. training_service.verify_user_login()
   ↓
4. auth_service.verify_password()
   ↓
5. auth_service.generate_token()
   ↓
6. Returns: {token, full_name, expires_at}
   ↓
7. Student → GET /academy/video/{id}/stream-url?token=...
   ↓
8. training_controller.get_stream_url()
   ↓
9. auth_service.verify_token()
   ↓
10. training_service.verify_video_access()
   ↓
11. training_service.log_video_view()
   ↓
12. s3_service.generate_download_url()
   ↓
13. Returns: {stream_url, expires_in}
   ↓
14. Student streams video from S3 using signed URL
```

## Layer Responsibilities

### Controllers Layer
- **Purpose**: Handle HTTP requests and responses
- **Responsibilities**:
  - Route definitions
  - Request validation (via Pydantic)
  - Call appropriate services
  - Format responses
  - Error handling (HTTP exceptions)
- **Does NOT**:
  - Contain business logic
  - Access database directly
  - Handle S3 operations

### Services Layer
- **Purpose**: Implement business logic
- **Responsibilities**:
  - Business rules and validation
  - Coordinate between data layer and external services
  - Reusable operations
  - Transaction management
- **Does NOT**:
  - Handle HTTP requests/responses
  - Know about FastAPI

### Data Layer
- **Purpose**: Database operations
- **Responsibilities**:
  - ORM models (SQLAlchemy)
  - Data validation (Pydantic)
  - CRUD operations
  - Query building
- **Does NOT**:
  - Contain business logic
  - Handle HTTP

## Security Architecture

### Authentication Flow

```
┌─────────────┐
│   Student   │
└──────┬──────┘
       │
       │ 1. POST /academy/login
       │    {username, password, session_id}
       ▼
┌─────────────────────────────────┐
│  training_controller.py         │
│  academy_login()                │
└──────┬──────────────────────────┘
       │
       │ 2. Verify credentials
       ▼
┌─────────────────────────────────┐
│  training_service.py            │
│  verify_user_login()            │
└──────┬──────────────────────────┘
       │
       │ 3. Check password
       ▼
┌─────────────────────────────────┐
│  auth_service.py                │
│  verify_password()              │
└──────┬──────────────────────────┘
       │
       │ 4. Generate token
       ▼
┌─────────────────────────────────┐
│  auth_service.py                │
│  generate_token()               │
│  → HMAC(access_id:session_id)   │
└──────┬──────────────────────────┘
       │
       │ 5. Return token
       ▼
┌─────────────┐
│   Student   │
│  (has token)│
└─────────────┘
```

### Video Access Control

```
┌─────────────┐
│   Student   │
│  (has token)│
└──────┬──────┘
       │
       │ 1. GET /academy/video/{id}/stream-url?token=...
       ▼
┌─────────────────────────────────┐
│  training_controller.py         │
│  get_stream_url()               │
└──────┬──────────────────────────┘
       │
       │ 2. Verify token
       ▼
┌─────────────────────────────────┐
│  auth_service.py                │
│  verify_token()                 │
│  → Check HMAC signature         │
└──────┬──────────────────────────┘
       │
       │ 3. Check access
       ▼
┌─────────────────────────────────┐
│  training_service.py            │
│  verify_video_access()          │
│  → Video in user's session?     │
└──────┬──────────────────────────┘
       │
       │ 4. Log view
       ▼
┌─────────────────────────────────┐
│  training_service.py            │
│  log_video_view()               │
└──────┬──────────────────────────┘
       │
       │ 5. Generate signed URL
       ▼
┌─────────────────────────────────┐
│  s3_service.py                  │
│  generate_download_url()        │
│  → Pre-signed S3 GET URL        │
└──────┬──────────────────────────┘
       │
       │ 6. Return signed URL
       ▼
┌─────────────┐
│   Student   │
│  → S3 URL   │
└──────┬──────┘
       │
       │ 7. Stream video
       ▼
┌─────────────┐
│   AWS S3    │
└─────────────┘
```

## Database Schema (Training Tables)

```sql
training_videos
├── id (PK)
├── title
├── description
├── filename
├── s3_key          -- S3 object key
├── s3_bucket       -- S3 bucket name
├── file_size_bytes
├── mime_type
├── duration_seconds
├── is_public
└── created_at

training_sessions
├── id (PK)
├── title
├── description
├── instructor_name
├── category
├── total_duration_minutes
├── access_expiry_days
├── difficulty_level
├── is_active
└── created_at

training_session_videos (junction table)
├── id (PK)
├── training_session_id (FK)
├── video_id (FK)
└── display_order

training_user_access
├── id (PK)
├── training_session_id (FK)
├── username
├── password_hash
├── full_name
├── email
├── is_active
├── access_expires_at
├── last_access_at
├── access_count
└── created_at

training_video_view_logs
├── id (PK)
├── user_access_id (FK)
├── video_id (FK)
├── training_session_id (FK)
├── ip_address
├── user_agent
└── viewed_at
```

## Configuration

### Environment Variables

```bash
# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
S3_TRAINING_BUCKET=likestudio-training
S3_PRESIGN_EXPIRY_SECONDS=3600  # 1 hour

# Authentication
ACADEMY_SECRET=your-secret-key-here

# Database
DATABASE_URL=sqlite:///./likestudio.db
```

## Deployment Considerations

### Development
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Production
```bash
# Use gunicorn with uvicorn workers
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile -
```

### Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
CMD ["gunicorn", "app.main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

## Performance Considerations

1. **S3 Direct Upload/Download**: Videos don't go through backend, reducing server load
2. **Signed URLs**: Expire automatically, no cleanup needed
3. **Database Indexing**: Add indexes on frequently queried fields
4. **Connection Pooling**: SQLAlchemy handles this automatically
5. **Caching**: Consider adding Redis for session data

## Monitoring

### Key Metrics to Track
- Video view counts (already logged)
- Failed login attempts
- S3 upload/download errors
- Token verification failures
- Database query performance

### Logging Points
- User login/logout
- Video access (already implemented)
- S3 operations
- Authentication failures
- API errors
