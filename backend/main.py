from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import router as api_router
from app.api.auth_routes import router as auth_router
from app.repositories.chat_repo import init_indexes
from app.services.rag_service import ensure_rag_indexes
from app.services.memory_service import ensure_memory_indexes
from app.db.mongo import close_client

app = FastAPI(title="Taliyo AI Backend", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# API routes
app.include_router(api_router)
app.include_router(auth_router)


@app.on_event("startup")
async def _on_startup():
    try:
        await init_indexes()
        await ensure_rag_indexes()
        await ensure_memory_indexes()
    except Exception:
        # Index creation errors should not crash the app in dev
        pass


@app.on_event("shutdown")
async def _on_shutdown():
    try:
        await close_client()
    except Exception:
        pass
