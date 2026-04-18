#!/usr/bin/env python3
import re

# Read the file
with open('app/main.py', 'r') as f:
    content = f.read()

# Pattern to find admin endpoints that need auth
# This finds function definitions that have db: Session = Depends(get_db), but not the auth dependency
pattern = r'(def admin_\w+\([^)]*\n[^)]*db: Session = Depends\(get_db\),)(\n[^)]*\):)'

# Replace with version that includes auth
replacement = r'\1\n    _: models.AdminUser = Depends(get_admin_user),\2'

# Do the replacement
new_content = re.sub(pattern, replacement, content)

# Count replacements
count = len(re.findall(pattern, content))
print(f"Found {count} admin endpoints to update")

# Write back
with open('app/main.py', 'w') as f:
    f.write(new_content)

print("Updated main.py with authentication dependencies")
