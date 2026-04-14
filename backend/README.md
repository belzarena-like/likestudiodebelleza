# Like Studio Backend

FastAPI backend for Like Studio beauty salon management system with training/academy features.

## Features

- 👥 Client management
- 📅 Appointment scheduling
- 💆 Treatment session tracking
- 📝 Consent form management
- 🎓 Training academy with video courses
- 🔐 Secure video streaming with signed S3 URLs
- 👨‍🎓 Student access management

## Architecture

The backend follows a clean architecture pattern:

```
app/
├── controllers/     # HTTP request handlers
├── services/        # Business logic
├── models.py        # Database models
├── schemas.py       # Pydantic schemas
├── crud.py          # Database operations
└── main.py          # Application entry point
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

## Recent Changes

**Version 0.2.0** - Backend Refactoring
- ✅ Refactored to clean architecture
- ✅ Separated controllers, services, and data layers
- ✅ Confirmed signed S3 URLs for training videos
- ✅ Improved code maintainability and testability

See [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md) for migration details.

## Quick Start

### Prerequisites

- Python 3.11+
- pip
- AWS S3 account (for training videos)

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export S3_TRAINING_BUCKET=your_bucket
export ACADEMY_SECRET=your_secret

# Run server
uvicorn app.main:app --reload
```

### Development

```bash
# Run with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests (if available)
pytest

# Check code style
black app/
flake8 app/
```

### Production

```bash
# Using gunicorn
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Environment Variables

### Required

```bash
# AWS S3 (for training videos)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
S3_TRAINING_BUCKET=likestudio-training

# Authentication
ACADEMY_SECRET=liegeJosemi2026

# Database
DATABASE_URL=sqlite:///./likestudio.db
```

### Optional

```bash
# S3 signed URL expiry (default: 3600 seconds = 1 hour)
S3_PRESIGN_EXPIRY_SECONDS=3600
```

## Key Endpoints

### Health
- `GET /health` - Health check

### Training (Admin)
- `GET /admin/training/sessions` - List training sessions
- `POST /admin/training/sessions` - Create training session
- `GET /admin/training/videos` - List videos
- `POST /admin/training/videos/upload-url` - Get S3 upload URL
- `POST /admin/training/videos` - Register video metadata

### Training (Student)
- `POST /academy/login` - Student login
- `GET /academy/session/{id}` - Get session details
- `GET /academy/video/{id}/stream-url` - Get video stream URL (signed)

### Clients
- `GET /admin/clients` - List clients
- `POST /clients` - Create/update client
- `PUT /admin/clients/{id}` - Update client

### Appointments
- `GET /admin/appointments` - List appointments
- `POST /appointments` - Create appointment
- `PUT /appointments/{id}` - Update appointment

### Services
- `GET /public/services` - List active services
- `GET /admin/services` - List all services
- `POST /admin/services` - Create service

## Database

### SQLite (Development)
```bash
DATABASE_URL=sqlite:///./likestudio.db
```

### PostgreSQL (Production)
```bash
DATABASE_URL=postgresql://user:password@localhost/likestudio
```

### Migrations

Database schema is auto-created on startup. For production, consider using Alembic for migrations.

## Security

### Video Access
- Videos are stored in S3
- Access via signed URLs (expire after 1 hour by default)
- Token-based authentication for students
- Access control per training session
- View logging for analytics

### Authentication
- Password hashing with bcrypt (via passlib)
- HMAC-signed tokens for student sessions
- Token verification on every request

### Best Practices
- Never commit secrets to git
- Use environment variables for configuration
- Rotate ACADEMY_SECRET regularly
- Monitor failed login attempts
- Review access logs regularly

## Troubleshooting

### Server won't start
- Check Python version (3.11+)
- Verify all dependencies installed
- Check environment variables set
- Review error logs

### Videos won't upload
- Verify AWS credentials
- Check S3 bucket exists
- Verify bucket permissions
- Check CORS configuration on S3

### Students can't login
- Verify ACADEMY_SECRET is set
- Check user exists in database
- Verify access hasn't expired
- Check password is correct

### Videos won't play
- Verify signed URL is generated
- Check URL hasn't expired
- Verify S3 bucket is accessible
- Check video file exists in S3

## Documentation

- [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md) - Migration guide
- [REFACTORING.md](REFACTORING.md) - Detailed refactoring docs
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [MIGRATION_CHECKLIST.md](MIGRATION_CHECKLIST.md) - Migration checklist

## Contributing

1. Follow clean architecture principles
2. Add services for business logic
3. Add controllers for HTTP endpoints
4. Keep models and schemas separate
5. Write tests for new features
6. Update documentation

## License

Proprietary - Like Studio de Belleza

## Support

For issues or questions, contact the development team.




docker buildx build --platform linux/arm64 -f backend/Dockerfile -t likestudio-backend:latest --load .
docker save likestudio-backend:latest -o likestudio-backend.tar
