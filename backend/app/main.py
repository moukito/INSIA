from fastapi import FastAPI

from app.api import api_router

app = FastAPI(title="INSIA API", version="0.1.0")
app.include_router(api_router)