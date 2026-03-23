"""
Database configuration for Supabase PostgreSQL with SQLAlchemy async
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

load_dotenv(Path(__file__).parent / '.env')

DATABASE_URL = os.environ.get('DATABASE_URL')

if DATABASE_URL:
    # Convert to async driver
    ASYNC_DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')
    
    engine = create_async_engine(
        ASYNC_DATABASE_URL,
        pool_size=10,
        max_overflow=5,
        pool_timeout=30,
        pool_recycle=1800,
        pool_pre_ping=False,
        echo=False,
        connect_args={
            "statement_cache_size": 0,  # Required for transaction pooler
            "command_timeout": 30,
        }
    )
    
    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False
    )
else:
    engine = None
    AsyncSessionLocal = None

Base = declarative_base()

async def get_db():
    """Dependency for getting database sessions"""
    if AsyncSessionLocal is None:
        raise Exception("Database not configured. Please set DATABASE_URL in backend/.env")
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
