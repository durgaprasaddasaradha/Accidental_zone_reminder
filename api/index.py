import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import zones
from api.routes import demo
from api.services.data_service import DataService, InMemoryZoneStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the real 2024 dataset into memory.
    if not InMemoryZoneStore.get_zones():
        data_csv = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "data",
            "raw",
            "accident_zones_2024_normalized.csv",
        )

        if os.path.exists(data_csv):
            try:
                service = DataService()

                records, issues = service.load_and_process_csv(data_csv)

                InMemoryZoneStore.set_zones(records)

                print(
                    f"[Data Module] Loaded "
                    f"{len(records)} real 2024 accident-zone records."
                )

                if issues:
                    print(
                        f"[Data Module] Validation issues found: "
                        f"{len(issues)}"
                    )

            except Exception as e:
                print(
                    f"[Warning] Could not load 2024 "
                    f"accident-zone data: {e}"
                )
        else:
            print(
                f"[Warning] 2024 dataset not found: "
                f"{data_csv}"
            )

    yield


# ── CORS allowed origins ────────────────────────────────────────────────────
# In production, ALLOWED_ORIGINS should be set to your Vercel frontend URL.
# Example: ALLOWED_ORIGINS=https://your-app.vercel.app
# For local development, an empty value falls back to allowing localhost.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")

# Build the allowed origins list
_allowed_origins: list[str] = []

if _raw_origins.strip():
    # Parse comma-separated list from environment variable
    _allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# Always allow local development origins
_dev_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

for _origin in _dev_origins:
    if _origin not in _allowed_origins:
        _allowed_origins.append(_origin)


app = FastAPI(
    title="Accidental Zone Reminder System API",
    description=(
        "Backend API for accident-prone zone data, "
        "GPS monitoring, analysis and demo safety alerts."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# CORS — restrict to known origins in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
)


# Real 2024 accident-zone routes
app.include_router(zones.router)

# Demo GPS-zone routes
app.include_router(demo.router)


@app.get("/")
def root():
    return {
        "name": "Accidental Zone Reminder System API",
        "status": "online",
        "version": "1.0.0",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "accidental-zone-reminder-api",
    }