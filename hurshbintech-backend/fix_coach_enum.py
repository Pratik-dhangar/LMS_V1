from sqlalchemy import create_engine, text

# Hardcode for quick fix
DATABASE_URL = "postgresql://postgres:admin@localhost:5432/hurshbintech_db"

engine = create_engine(DATABASE_URL)
conn = engine.connect()

# Check what enum values currently exist
result = conn.execute(text("""
    SELECT enumlabel 
    FROM pg_enum 
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
    ORDER BY enumlabel;
"""))

print("Current userrole enum values:")
for row in result:
    print(f"  - {row[0]}")

# Add COACH if not exists
try:
    conn.execute(text("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'COACH' 
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
            ) THEN
                ALTER TYPE userrole ADD VALUE 'COACH';
            END IF;
        END $$;
    """))
    conn.commit()
    print("\n✓ Added 'COACH' to userrole enum")
except Exception as e:
    print(f"\n✗ Error adding COACH: {e}")
    conn.rollback()

# Remove lowercase 'coach' if it exists
try:
    # Check if lowercase 'coach' exists
    result = conn.execute(text("""
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'coach' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
    """))
    if result.fetchone():
        print("\n⚠ Warning: lowercase 'coach' exists but cannot be removed while enum is in use")
        print("  This is OK - PostgreSQL will use 'COACH' going forward")
except Exception as e:
    pass

conn.close()
print("\n✓ Done!")
