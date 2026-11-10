from fastapi import APIRouter

from app.api.routes.assistant import router as assistant_router
from app.api.routes.calendar import router as calendar_router
from app.api.routes.tools import router as tools_router

api_router = APIRouter(prefix="/api")
api_router.include_router(calendar_router)
api_router.include_router(tools_router)
api_router.include_router(assistant_router)
