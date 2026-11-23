"""Create the application database inside the setup-owned local PostgreSQL cluster."""
import asyncio
import os

import asyncpg


async def main():
    connection = await asyncpg.connect(
        host="127.0.0.1", port=int(os.environ["DB_PORT"]), user="lms_local",
        password=os.environ["DB_PASSWORD"], database="postgres",
    )
    try:
        if not await connection.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", "hurshbintech_pwa"
        ):
            await connection.execute('CREATE DATABASE "hurshbintech_pwa" OWNER "lms_local"')
            print("Local database created.")
        else:
            print("Local database already exists; preserved.")
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
