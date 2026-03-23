"""
LeadFlow AI - Intent Signal Monitoring Platform
FastAPI Backend Server

Environment Variables Required:
- DATABASE_URL: Supabase PostgreSQL Transaction Pooler URL
- ANTHROPIC_API_KEY: Your Anthropic API key for Claude
- APIFY_WEBHOOK_SECRET: Secret for validating Apify webhooks
- JWT_SECRET_KEY: Secret for JWT token signing
"""
import os
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv(Path(__file__).parent / '.env')

from routes import auth_router, signals_router, webhook_router, leads_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup/shutdown events"""
    # Startup
    print("=" * 50)
    print("LeadFlow AI Backend Starting...")
    print("=" * 50)
    
    # Check critical environment variables
    db_url = os.environ.get('DATABASE_URL')
    anthropic_key = os.environ.get('ANTHROPIC_API_KEY')
    
    if not db_url:
        print("⚠️  WARNING: DATABASE_URL not set - database features will not work")
    else:
        print("✅ DATABASE_URL configured")
    
    if not anthropic_key:
        print("⚠️  WARNING: ANTHROPIC_API_KEY not set - AI agents will not work")
    else:
        print("✅ ANTHROPIC_API_KEY configured")
    
    print("=" * 50)
    
    yield
    
    # Shutdown
    print("LeadFlow AI Backend Shutting down...")


# Initialize FastAPI app
app = FastAPI(
    title="LeadFlow AI",
    description="Intent Signal Monitoring Platform with AI-Powered Cold Email Generation",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Specific origins for credentials
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(signals_router, prefix="/api")
app.include_router(webhook_router, prefix="/api")
app.include_router(leads_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "LeadFlow AI Backend",
        "version": "1.0.0"
    }


@app.get("/api/config/env-status")
async def env_status():
    """Check which environment variables are configured (for debugging)"""
    return {
        "database_configured": bool(os.environ.get('DATABASE_URL')),
        "anthropic_configured": bool(os.environ.get('ANTHROPIC_API_KEY')),
        "webhook_secret_configured": bool(os.environ.get('APIFY_WEBHOOK_SECRET')),
        "jwt_configured": bool(os.environ.get('JWT_SECRET_KEY'))
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
