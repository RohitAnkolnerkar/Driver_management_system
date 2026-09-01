import logging
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse

import app.models as app_models  # noqa: F401
from app.api import (
    auth,
    detention,
    driver,
    esg,
    expense,
    finance,
    fuel,
    fuel_theft,
    invoice,
    matchmaking,
    notification,
    ocr,
    payments_razorpay,
    pod,
    pricing,
    trip,
    users,
    vehicle,
    ws,
)
from app.config import settings
from app.core.logging_config import request_id_ctx, setup_logging

setup_logging()

logger = logging.getLogger("app.request")

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


@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Retrieve existing request ID from headers (e.g. if forwarded by proxy) or generate a new one
    req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    # Bind request_id to context variable
    token = request_id_ctx.set(req_id)

    start_time = time.time()
    logger.info(f"Incoming request: {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        # Set correlation header in HTTP response
        response.headers["X-Request-ID"] = req_id
        process_time = (time.time() - start_time) * 1000
        logger.info(
            f"Response: {request.method} {request.url.path} - "
            f"status={response.status_code} - duration={process_time:.2f}ms"
        )
        return response
    except Exception as e:
        process_time = (time.time() - start_time) * 1000
        logger.exception(
            f"Request failed: {request.method} {request.url.path} - "
            f"duration={process_time:.2f}ms - error={str(e)}"
        )
        raise
    finally:
        # Reset context variable to prevent leakage across requests
        request_id_ctx.reset(token)


app.include_router(driver.router)
app.include_router(trip.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(ws.router)
app.include_router(fuel.router)
app.include_router(vehicle.router)
app.include_router(pricing.router)
app.include_router(matchmaking.router)
app.include_router(pod.router)
app.include_router(invoice.router)
app.include_router(esg.router)
app.include_router(detention.router)
app.include_router(fuel_theft.router)
app.include_router(expense.router)
app.include_router(finance.router)
app.include_router(payments_razorpay.router)
app.include_router(notification.router)
app.include_router(ocr.router)


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
    """Health check endpoint for system probes and CI/CD pipeline verification."""
    return {"status": "ok", "service": settings.APP_NAME}


@app.get("/ready")
def readiness_check():
    """Readiness probe endpoint for container orchestration checks."""
    return {"status": "ready", "service": settings.APP_NAME}
