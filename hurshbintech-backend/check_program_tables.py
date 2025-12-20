"""Check program assignment tables"""
from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(settings.DATABASE_URI.replace("+asyncpg", ""))
conn = engine.connect()

# Check for program assignment tables
result = conn.execute(text("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'program%'
    ORDER BY table_name;
"""))

tables = [t[0] for t in result.fetchall()]
print("Program tables in database:")
for t in tables:
    print(f"  ✓ {t}")

# Check specific tables
expected = ['program_assignments', 'program_learning_contents', 'program_assignment_attachments']
missing = [t for t in expected if t not in tables]
if missing:
    print("\n❌ MISSING tables:")
    for t in missing:
        print(f"  - {t}")
else:
    print("\n✅ All program assignment tables created successfully!")

conn.close()
