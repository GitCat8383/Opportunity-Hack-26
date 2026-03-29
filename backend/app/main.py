from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import ai, clients, org_config, service_entries

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    docs_url=f"{settings.api_prefix}/docs",
    openapi_url=f"{settings.api_prefix}/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(clients.router, prefix=settings.api_prefix)
app.include_router(service_entries.router, prefix=settings.api_prefix)
app.include_router(org_config.router, prefix=settings.api_prefix)
app.include_router(ai.router, prefix=settings.api_prefix)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
