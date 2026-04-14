"""S3 service for handling file uploads and signed URLs."""

import os
import secrets
from typing import Dict

try:
    import boto3
    from botocore.exceptions import ClientError as BotoClientError

    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False


class S3Service:
    """Service for S3 operations."""

    def __init__(self):
        self.bucket = os.environ.get(
            "S3_TRAINING_BUCKET", "likestudio-training-022499031203-eu-north-1-an"
        )
        self.presign_expiry = int(os.environ.get("S3_PRESIGN_EXPIRY_SECONDS", "3600"))
        self.has_boto3 = HAS_BOTO3

    def _get_client(self):
        """Get S3 client with SigV4 configuration."""
        if not self.has_boto3:
            raise RuntimeError("boto3 not installed")

        from botocore.config import Config

        # Configure client to use Signature Version 4 (required for eu-north-1 and other regions)
        config = Config(
            signature_version="s3v4",
            region_name=os.environ.get("AWS_REGION", "eu-north-1"),
        )

        return boto3.client(
            "s3",
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
            region_name=os.environ.get("AWS_REGION", "eu-north-1"),
            config=config,
        )

    def generate_upload_url(
        self, filename: str, content_type: str = "video/mp4"
    ) -> Dict[str, str]:
        """Generate pre-signed URL for uploading to S3."""
        s3 = self._get_client()
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "mp4"
        s3_key = f"training-videos/{secrets.token_hex(16)}.{ext}"
        url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": s3_key, "ContentType": content_type},
            ExpiresIn=3600,
        )
        return {
            "upload_url": url,
            "s3_key": s3_key,
            "s3_bucket": self.bucket,
            "content_type": content_type,  # Return the content_type so frontend knows what to use
        }

    def generate_download_url(
        self, s3_key: str, s3_bucket: str, mime_type: str
    ) -> Dict[str, any]:
        """Generate pre-signed URL for downloading/streaming from S3."""
        s3 = self._get_client()
        url = s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": s3_bucket,
                "Key": s3_key,
                "ResponseContentDisposition": "inline",
                "ResponseContentType": mime_type,
            },
            ExpiresIn=self.presign_expiry,
        )
        return {"stream_url": url, "expires_in": self.presign_expiry}

    def delete_object(self, s3_key: str, s3_bucket: str) -> bool:
        """Delete object from S3."""
        try:
            s3 = self._get_client()
            s3.delete_object(Bucket=s3_bucket, Key=s3_key)
            return True
        except Exception:
            return False
