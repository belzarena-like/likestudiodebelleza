@echo off
REM Migration script to switch to refactored backend structure (Windows)

echo Migrating to refactored backend structure...

REM Backup original main.py
if not exist "app\main_old.py" (
    echo Backing up original main.py...
    copy app\main.py app\main_old.py
)

REM Replace main.py with refactored version
echo Activating refactored main.py...
copy app\main_refactored.py app\main.py

echo Migration complete!
echo.
echo Next steps:
echo 1. Restart your FastAPI server
echo 2. Test the endpoints to ensure everything works
echo 3. If issues occur, restore with: copy app\main_old.py app\main.py
echo.
echo See REFACTORING.md for full documentation
