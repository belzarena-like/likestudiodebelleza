#!/usr/bin/env python3
"""
Load payments from CSV file into the database.
CSV format: Fecha | Ingresso | Gasto | Descripción | Sueldo | Metodo | Mes | Semana
"""

import csv
import sys
import os
from datetime import datetime
from pathlib import Path

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import Base, Payment, PaymentType, PaymentMethod


def parse_csv_row(row, row_num=None):
    """Parse a CSV row and return payment data or skip reason."""
    # Handle BOM character in column names
    fecha_str = row.get('Fecha', row.get('\ufeffFecha', '')).strip()
    ingresso = row.get('Ingresso', '').strip()
    gasto = row.get('Gasto', '').strip()
    descripcion = row.get('Descripción', '').strip()
    metodo = row.get('Metodo', '').strip().lower()
    
    # Parse date - try YYYY-MM-DD first (your format)
    try:

        payment_date = datetime.strptime(fecha_str, '%m/%d/%Y').date()
    except ValueError:
        try:
            payment_date = datetime.strptime(fecha_str, '%d/%m/%Y').date()
        except ValueError:
            return None, f"Invalid date format: '{fecha_str}'", row_num
    
    # Determine payment type and amount
    # Handle both empty strings and '0' values
    ingresso_val = None
    gasto_val = None
    
    if ingresso and ingresso != '0' and ingresso.strip():
        try:
            ingresso_val = abs(float(ingresso.replace(',', '.')))
        except ValueError:
            return None, f"Invalid ingresso amount: '{ingresso}'", row_num
    
    if gasto and gasto != '0' and gasto.strip():
        try:
            gasto_val = abs(float(gasto.replace(',', '.')))
        except ValueError:
            return None, f"Invalid gasto amount: '{gasto}'", row_num
    
    # Determine which one to use
    # Accept positive ingresso (income) or any non-zero gasto (expense, can be negative)
    if ingresso_val is not None and ingresso_val > 0:
        amount = abs(ingresso_val)
        payment_type = PaymentType.INCOME
    elif gasto_val is not None and gasto_val != 0:
        amount = abs(gasto_val)  # Use absolute value
        payment_type = PaymentType.EXPENSE
    else:
        # Skip rows with no valid amount
        return None, f"No valid amount (ingresso={ingresso}, gasto={gasto})", row_num
    
    # Map payment method
    method_map = {
        'efectivo': PaymentMethod.CASH,
        'cash': PaymentMethod.CASH,
        'tarjeta': PaymentMethod.CARD,
        'card': PaymentMethod.CARD,
        'transferencia': PaymentMethod.TRANSFER,
        'transfer': PaymentMethod.TRANSFER,
        'outro': PaymentMethod.OTHER,
        'other': PaymentMethod.OTHER,
    }
    
    payment_method = method_map.get(metodo, PaymentMethod.OTHER)
    
    return {
        'amount': amount,
        'payment_date': payment_date,
        'payment_type': payment_type,
        'payment_method': payment_method,
        'recipient': 'liege',  # Default recipient for imported payments
        'description': descripcion if descripcion else None  # Empty string becomes None
    }, None, None


def load_csv(csv_file_path, debug=False):
    """Load payments from CSV file into database."""
    csv_path = Path(csv_file_path)
    
    if not csv_path.exists():
        print(f"❌ File not found: {csv_file_path}")
        return False
    
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    # Print database info
    from app.database import DATABASE_URL
    print(f"📊 Using database: {DATABASE_URL}")
    
    db: Session = SessionLocal()
    
    try:
        # Clean existing payments
        print("\n🧹 Cleaning existing payments...")
        existing_count = db.query(Payment).count()
        if existing_count > 0:
            db.query(Payment).delete()
            db.commit()
            print(f"   Deleted {existing_count} existing payments")
        
        loaded_count = 0
        skipped_count = 0
        skip_reasons = {}  # Maps reason to list of row numbers
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            if not reader.fieldnames:
                print("❌ CSV file is empty or invalid")
                return False
            
            print(f"\n📋 CSV columns: {reader.fieldnames}")
            print(f"📥 Starting import...\n")
            
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (after header)
                payment_data, skip_reason, failed_row = parse_csv_row(row, row_num)
                
                if not payment_data:
                    skipped_count += 1
                    # Track skip reasons with sample row numbers
                    if skip_reason not in skip_reasons:
                        skip_reasons[skip_reason] = []
                    if len(skip_reasons[skip_reason]) < 5:  # Keep first 5 examples
                        skip_reasons[skip_reason].append(row_num)
                    continue
                
                try:
                    payment = Payment(**payment_data)
                    db.add(payment)
                    loaded_count += 1
                    
                    if loaded_count % 100 == 0:
                        print(f"  ✓ Loaded {loaded_count} payments...")
                
                except Exception as e:
                    print(f"⚠️  Error on row {row_num}: {str(e)}")
                    skipped_count += 1
        
        # Commit all changes
        db.commit()
        print(f"\n✅ Successfully loaded {loaded_count} payments")
        print(f"⚠️  Skipped {skipped_count} rows")
        
        # Print skip reasons with sample row numbers
        if skip_reasons:
            print(f"\n📊 Skip reasons:")
            for reason, row_nums in sorted(skip_reasons.items(), key=lambda x: len(x[1]), reverse=True):
                count = len(row_nums)
                # Count total occurrences (we only tracked first 5)
                total_count = skipped_count  # This is approximate, but we'll show what we tracked
                print(f"   • {reason}: {count} rows (samples: {', '.join(map(str, row_nums))})")
        
        # Verify data was inserted
        count = db.query(Payment).count()
        print(f"\n📊 Total payments in database: {count}")
        
        return True
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error loading CSV: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python load_csv_payments.py <csv_file_path>")
        print("Example: python load_csv_payments.py olddatali.csv")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    success = load_csv(csv_file)
    sys.exit(0 if success else 1)
