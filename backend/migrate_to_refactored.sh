#!/bin/bash
# Migration script to switch to refactored backend

echo "🔄 Migrating to refactored backend structure..."

# Backup original main.py
if [ ! -f "app/main_old.py" ]; then
    echo "📦 Backing up original main.py..."
    cp app/main.py app/main_old.py
fi

# Replace main.py with refactored version
echo "✨ Activating refactored main.py..."
cp app/main_refactored.py app/main.py

echo "✅ Migration complete!"
echo ""
echo "📝 Next steps:"
echo "1. Restart your FastAPI server"
echo "2. Test the endpoints to ensure everything works"
echo "3. If issues occur, restore with: cp app/main_old.py app/main.py"
echo ""
echo "📚 See REFACTORING.md for full documentation"
