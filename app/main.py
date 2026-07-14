from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse

from app.api import auth, driver, fuel, trip, users, vehicle, ws
from app.config import settings

app = FastAPI()
SITE_HTML = Path(__file__).resolve().parent / "templates" / "site.html"
DASHBOARD_HTML = Path(__file__).resolve().parent / "templates" / "dashboard.html"

# Enable CORS for frontend dashboard (update origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(driver.router)
app.include_router(trip.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(ws.router)
app.include_router(fuel.router)
app.include_router(vehicle.router)


@app.get("/")
def root():
    return {"message": f"{settings.APP_NAME} API Running", "env": settings.APP_ENV}


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    return SITE_HTML.read_text(encoding="utf-8")


@app.get("/legacy-dashboard")
def legacy_dashboard():
    return RedirectResponse(url="/dashboard", status_code=302)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": settings.APP_NAME}


@app.get("/ready")
def readiness_check():
    return {"status": "ready", "service": settings.APP_NAME}
