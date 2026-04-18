"""
Run migration 005: Convert payment_method values to uppercase
"""
import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables
load_dotenv()

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in environment")
    sys.exit(1)

print(f"Connecting to database...")
engine = create_engine(DATABASE_URL)

try:
    with engine.begin() as conn:
        print("Starting migration 005...")
        
        # Update existing payment_method values to uppercase
        updates = [
            ("CASH", "cash"),
            ("CARD", "card"),
            ("TRANSFER", "transfer"),
            ("COUPON", "coupon"),
            ("OTHER", "other"),
        ]
        
        for uppercase, lowercase in updates:
            result = conn.execute(
                text(f"UPDATE payments SET payment_method = :uppercase WHERE payment_method = :lowercase"),
                {"uppercase": uppercase, "lowercase": lowercase}
            )
            count = result.rowcount
            if count > 0:
                print(f"  Updated {count} records from '{lowercase}' to '{uppercase}'")
        
        print("Migration 005 completed successfully!")
        
except Exception as e:
    print(f"ERROR: Migration failed: {e}")
    sys.exit(1)
