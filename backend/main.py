"""
splitUP Backend - Phase 2: Core Logic with In-Memory Storage

Main FastAPI application entrypoint.
This is a self-contained backend with no database or authentication.
Uses in-memory storage for development.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import groups, expenses, balances, budgets, auth, debug_tests, dashboard, activity


from dotenv import load_dotenv
import os

load_dotenv()


# Mock current user (replaces authentication for Phase 2)
CURRENT_USER_ID = "user_123"
CURRENT_USER_NAME = "Test User"


# Create FastAPI app
app = FastAPI(
    title="splitUP API",
    description="Splitwise-style expense sharing backend - Phase 2 (In-Memory)",
    version="2.0.0"
)

# CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(activity.router, prefix="/api", tags=["activity"])
app.include_router(groups.router, prefix="/api", tags=["groups"])
app.include_router(expenses.router, prefix="/api", tags=["expenses"])
app.include_router(balances.router, prefix="/api", tags=["balances"])
app.include_router(budgets.router, prefix="/api", tags=["budgets"])
app.include_router(debug_tests.router, tags=["debug"])


@app.get("/")
async def root():
    """Root endpoint - health check"""
    return {
        "message": "splitUP API - Phase 2 (In-Memory)",
        "status": "running",
        "current_user": CURRENT_USER_ID
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
