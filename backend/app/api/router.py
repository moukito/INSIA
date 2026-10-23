from fastapi import APIRouter

from app.api.routes.calendar import router as calendar_router

api_router = APIRouter(prefix="/api")
api_router.include_router(calendar_router)
