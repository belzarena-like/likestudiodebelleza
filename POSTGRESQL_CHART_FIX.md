# PostgreSQL Chart Data Fix

## Issue

The chart data endpoint was failing with the following error:

```
sqlalchemy.exc.ProgrammingError: (psycopg2.errors.UndefinedFunction) 
function strftime(unknown, date) does not exist
```

This occurred because the code was using SQLite's `strftime()` function, but the database is PostgreSQL.

## Root Cause

In `backend/app/services/payment_service.py`, the `get_chart_data()` method was using SQLite-specific SQL functions:

```python
func.strftime('%Y-%m', models.Payment.payment_date)
```

PostgreSQL does not have a `strftime()` function. Instead, it uses `to_char()` for date formatting.

## Solution

Replaced SQLite's `strftime()` with PostgreSQL's `to_char()` function:

**Before:**
```python
monthly_stmt = select(
    func.strftime('%Y-%m', models.Payment.payment_date).label("month"),
    func.sum(models.Payment.amount).label("total_amount"),
    models.Payment.payment_type
).where(
    models.Payment.payment_date.between(start_date, end_date),
    models.Payment.deleted_at.is_(None)
).group_by(
    func.strftime('%Y-%m', models.Payment.payment_date), models.Payment.payment_type
).order_by(func.strftime('%Y-%m', models.Payment.payment_date))
```

**After:**
```python
monthly_stmt = select(
    func.to_char(models.Payment.payment_date, 'YYYY-MM').label("month"),
    func.sum(models.Payment.amount).label("total_amount"),
    models.Payment.payment_type
).where(
    models.Payment.payment_date.between(start_date, end_date),
    models.Payment.deleted_at.is_(None)
).group_by(
    func.to_char(models.Payment.payment_date, 'YYYY-MM'), models.Payment.payment_type
).order_by(func.to_char(models.Payment.payment_date, 'YYYY-MM'))
```

## Format String Differences

| SQLite | PostgreSQL | Output |
|--------|------------|--------|
| `%Y-%m` | `YYYY-MM` | 2026-04 |
| `%Y-%m-%d` | `YYYY-MM-DD` | 2026-04-18 |

## Files Modified

- `backend/app/services/payment_service.py` - Line 154, 159, 160

## Testing

The fix should now allow the chart data endpoint to work correctly with PostgreSQL:

1. Monthly trend chart will display correctly
2. Daily trend chart will display correctly
3. Payment method breakdown chart will display correctly

## Status

✅ **Fixed** - The chart data endpoint now uses PostgreSQL-compatible date formatting functions.

## Note

Python's `datetime.strftime()` calls (lines 210, 222) were left unchanged as they are Python functions, not SQL functions, and work correctly with any database.
