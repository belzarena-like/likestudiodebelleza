# Like Studio Backend - Setup Guide

## Prerequisites

- Python 3.10 or higher
- pip (Python package manager)
- AWS account with S3 access (for training videos)

## Installation

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Required packages:
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `sqlalchemy` - Database ORM
- `pydantic` - Data validation
- `passlib[bcrypt]` - Password hashing
- `boto3` - AWS SDK for S3
- `python-multipart` - File upload support

### 2. Configure Environment Variables

Copy the example environment file and update with your credentials:

```bash
cp .env.example .env
```

Edit `.env` and configure:

#### Database (SQLite for development)
```env
DATABASE_URL=sqlite:///./likestudio.db
```

#### AWS S3 (Required for training videos)
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_TRAINING_BUCKET=your-bucket-name
```

### 3. AWS S3 Setup

#### Create S3 Bucket
1. Go to AWS Console → S3
2. Create a new bucket (e.g., `likestudio-training`)
3. Enable versioning (optional but recommended)

#### Configure CORS Policy
Add this CORS configuration to your bucket:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"]
    }
]
```

#### IAM Permissions
Your AWS user needs these permissions:
- `s3:PutObject` - Upload videos
- `s3:GetObject` - Download/stream videos
- `s3:DeleteObject` - Delete videos
- `s3:ListBucket` - List videos

Example IAM policy:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::likestudio-training/*"
        },
        {
            "Effect": "Allow",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::likestudio-training"
        }
    ]
}
```

### 4. Initialize Database

The database will be created automatically on first run. Tables are created via SQLAlchemy migrations on startup.

## Running the Server

### Development Mode

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The `--reload` flag enables auto-reload on code changes.

### Production Mode

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Database Management

### SQLite (Development)
- Database file: `backend/likestudio.db`
- No additional setup required
- Good for development and testing

### PostgreSQL (Production)
1. Install PostgreSQL
2. Create database: `createdb likestudio`
3. Update `.env`:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/likestudio
   ```

## Troubleshooting

### Import Error: boto3
```bash
pip install boto3
```

### Import Error: passlib
```bash
pip install passlib[bcrypt]
```

### S3 Upload Fails
- Check AWS credentials in `.env`
- Verify bucket exists and CORS is configured
- Check IAM permissions

### Database Locked (SQLite)
- Close any other connections to the database
- Use PostgreSQL for production

## Security Notes

1. Never commit `.env` to version control
2. Use strong passwords for production databases
3. Rotate AWS credentials regularly
4. Use HTTPS in production
5. Configure proper CORS origins (not `*`)
6. Enable S3 bucket encryption
7. Use IAM roles instead of access keys when possible

## Next Steps

- Configure email notifications (optional)
- Set up backup strategy for database
- Configure monitoring and logging
- Set up CI/CD pipeline
- Review security settings before production deployment
