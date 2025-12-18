from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
conn = engine.connect()

# Check what tables exist
result = conn.execute(text("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%coach%'
    ORDER BY table_name;
"""))

tables = result.fetchall()
print("Coach-related tables in database:")
for table in tables:
    print(f"  - {table[0]}")

# Check coach_reference_data specifically
result = conn.execute(text("""
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'coach_reference_data'
    );
"""))
exists = result.fetchone()[0]
print(f"\ncoach_reference_data table exists: {exists}")

conn.close()
