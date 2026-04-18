#!/usr/bin/env python3
"""
Initialize admin user in the database.
Run this script once to create the initial admin user.

Usage:
    python3 init_admin_user.py
"""

import sys
import os

# Add app directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.database import SessionLocal, Base, engine
from app.models import AdminUser
from app.services.auth_service import hash_password

def init_admin_user():
    """Create initial admin user"""
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if admin user already exists
        existing = db.query(AdminUser).filter(AdminUser.username == "likestudio").first()
        if existing:
            print("Admin user 'likestudio' already exists")
            return
        
        # Create admin user with default credentials
        # IMPORTANT: Change these credentials after first login!
        admin_user = AdminUser(
            username="likestudio",
            password_hash=hash_password("liegeJosemi2026"),
            full_name="Like Studio Admin",
            email=None,
            is_active=True
        )
        
        db.add(admin_user)
        db.commit()
        
        print("✓ Admin user created successfully")
        print("  Username: likestudio")
        print("  Password: liegeJosemi2026")
        print("\n⚠️  IMPORTANT: Change the password after first login!")
        
    except Exception as e:
        print(f"✗ Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_admin_user()
