# Accidental Zone Reminder System

An intelligent road-safety warning application designed to alert drivers when approaching officially identified accident-prone and black-spot zones across India.

---

## 1. Module Architecture & Scope

To ensure strict engineering discipline, modularity, and high reliability, the system is architected into four sequential, decoupled modules:

```
┌────────────────────────────────────────────────────────┐
│               1. DATA MODULE (THIS PHASE)              │
│  - Supabase PostgreSQL schema                          │
│  - Data validation, cleaning, & normalization          │
│  - Official MoRTH & Open Government Data adapter       │
│  - RESTful API endpoints & Pydantic models             │
│  - React + TypeScript + Tailwind registry frontend     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│            2. LOCATION MODULE (FUTURE PHASE)           │
│  - Driver GPS acquisition & tracking                   │
│  - Heading, speed, & accuracy filtering                │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│          3. COMPUTATION MODULE (FUTURE PHASE)          │
│  - Haversine / geodesic distance calculations          │
│  - Geofence entry/exit detection                       │
│  - Proximity radius evaluation                         │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             4. ALERT MODULE (FUTURE PHASE)             │
│  - Voice and audio tone warnings                       │
│  - Visual HUD notifications                            │
│  - Driver alert rate-limiting & cooldown               │
└────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Strict Phase 1 Scope**: This implementation covers **ONLY the Data Module and backend foundation**. Live GPS tracking, distance calculations, geofencing, alerts, and map rendering are reserved for future phases.

---

## 2. Project Directory Structure

```
Accidental-Zone-Reminder/
├── api/
│   ├── __init__.py
│   ├── index.py                       # FastAPI entrypoint, lifespan, CORS
│   ├── database/
│   │   ├── __init__.py
│   │   └── supabase.py                # Server-side Supabase client & credentials validation
│   ├── models/
│   │   ├── __init__.py
│   │   └── zone.py                    # Domain model for accident zones
│   ├── routes/
│   │   ├── __init__.py
│   │   └── zones.py                   # GET /api/zones, GET /api/zones/{id}, GET /api/zones/stats
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── zone.py                    # Pydantic v2 schemas and coordinate validators
│   └── services/
│       ├── __init__.py
│       ├── data_service.py            # pandas & NumPy data cleaning, validation, & importer
│       └── official_data_service.py   # OfficialDataSource adapter & MoRTH protocol
│
├── data/
│   ├── official/
│   │   └── README.md                  # Guidelines for verified government datasets
│   ├── raw/
│   │   └── accident_zones_demo.csv    # DEMO DATA with verified & null coordinate samples
│   └── processed/
│       └── .gitkeep
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── index.css
│       ├── main.tsx
│       ├── components/                # Placeholder for shared UI components
│       ├── pages/                     # Placeholder for application pages
│       ├── hooks/                     # Placeholder for shared hooks
│       ├── services/                  # Placeholder for shared services
│       ├── types/                     # Placeholder for global types
│       ├── utils/                     # Placeholder for global utils
│       └── modules/
│           ├── data/
│           │   ├── components/
│           │   │   ├── ZoneCard.tsx   # Card displaying provenance, attributes, and coords
│           │   │   └── ZoneList.tsx   # Filterable list with metrics summary bar
│           │   ├── services/
│           │   │   └── zoneService.ts # Client API service calling /api/zones
│           │   ├── types/
│           │   │   └── zone.ts        # TypeScript interfaces matching backend models
│           │   └── utils/
│           ├── location/              # Placeholder for future Location Module
│           ├── computation/           # Placeholder for future Computation Module
│           └── alert/                 # Placeholder for future Alert Module
│
├── tests/
│   ├── test_api_endpoints.py          # FastAPI test suite (list, filter, stats, 404)
│   ├── test_coordinate_validation.py  # Lat/lon bounds [-90,90] and NULL preservation tests
│   ├── test_csv_validation.py         # CSV column validation and text normalization
│   ├── test_duplicate_detection.py    # Black spot code and location deduplication
│   └── test_official_adapter.py       # MoRTH adapter contract and schema mapping
│
├── .env.example                       # Environment variables template
├── requirements.txt                   # Backend Python dependencies
├── supabase_schema.sql                # Complete PostgreSQL DDL, indexes, triggers, & RLS
├── vercel.json                        # Vercel Serverless deployment configuration
└── README.md
```

---

## 3. Database Schema (Supabase PostgreSQL)

The schema is defined in [`supabase_schema.sql`](./supabase_schema.sql).

### Key Fields & Rules

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | Auto-generated via `gen_random_uuid()` |
| `name` | `TEXT NOT NULL` | Name or descriptive location of the black spot |
| `state` | `VARCHAR(100) NOT NULL` | State (normalized title case) |
| `district` | `VARCHAR(100) NOT NULL` | District (normalized title case) |
| `highway` | `VARCHAR(100)` | Highway code (e.g., NH-48) |
| `road_type` | `VARCHAR(100)` | Road classification |
| `black_spot_code` | `VARCHAR(100)` | Official government black spot identifier |
| `latitude` | `NUMERIC(10, 7) NULL` | **Strictly Nullable**. Fake coordinates are never created. |
| `longitude` | `NUMERIC(10, 7) NULL` | **Strictly Nullable**. Coordinates preserved as NULL if missing. |
| `accident_count` | `INTEGER` | Cumulative recorded accidents |
| `fatalities` | `INTEGER` | Cumulative recorded fatalities |
| `severity` | `VARCHAR(50)` | Classification (High, Medium, Low) |
| `official_priority` | `VARCHAR(50)` | Remediation priority (Priority 1, 2, etc.) |
| `warning_radius` | `INTEGER DEFAULT 500` | Warning radius in meters for future Alert Module |
| `source` | `VARCHAR(150) NOT NULL` | Provenance identifier (e.g. `MORTH_BLACK_SPOT`) |
| `source_url` | `TEXT` | Official reference link |
| `source_date` | `DATE` | Publication date of source document |
| `data_period_start` | `DATE` | Start date of official study period |
| `data_period_end` | `DATE` | End date of official study period |
| `location_source` | `VARCHAR(50)` | `OFFICIAL`, `VERIFIED_DERIVED`, or `UNKNOWN` |
| `location_accuracy` | `VARCHAR(50)` | `EXACT`, `APPROXIMATE`, or `UNKNOWN` |
| `is_active` | `BOOLEAN DEFAULT TRUE`| Active monitoring flag |
| `created_at` | `TIMESTAMPTZ` | Auto-set on creation |
| `updated_at` | `TIMESTAMPTZ` | Auto-updated via trigger |

### Setup in Supabase
1. Open your Supabase Project Dashboard.
2. Navigate to the **SQL Editor**.
3. Copy the entire contents of [`supabase_schema.sql`](./supabase_schema.sql) and paste into the editor.
4. Click **Run**.
5. The `accident_zones` table, performance indexes, timestamp triggers, and Row Level Security (RLS) policies will be created.

---

## 4. Environment Variables & Security

Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```

```env
# Supabase Configuration (Backend Only - NEVER expose to frontend)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here

# FastAPI Backend Configuration
PORT=8000
HOST=0.0.0.0

# Frontend API Endpoint (Used by Vite during development)
VITE_API_URL=http://localhost:8000
```

> [!CAUTION]
> **Security Mandate**:
> - `SUPABASE_SERVICE_ROLE_KEY` has administrative bypass privileges. It is **never** bundled into the React/Vite code or sent to the client browser.
> - The frontend communicates strictly with the FastAPI backend (`/api/zones`).
> - If `SUPABASE_URL` is omitted or unconfigured, the backend automatically operates in an **In-Memory Development Mode**, serving the validated records from `data/raw/accident_zones_demo.csv` so you can develop and test completely offline!

---

## 5. How to Run the Backend Locally

### Prerequisites
- Python 3.10+ (tested on Python 3.14)
- Virtual environment or system Python with dependencies installed

### 1. Install Dependencies
```powershell
python -m pip install -r requirements.txt
```

### 2. Start FastAPI Server
```powershell
python -m uvicorn api.index:app --reload --port 8000
```

The API will be available at:
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## 6. How to Run the Frontend Locally

### 1. Install Dependencies
```powershell
cd frontend
npm.cmd install
```

### 2. Start Vite Development Server
```powershell
npm.cmd run dev
```

The frontend will run at [http://localhost:5173](http://localhost:5173). Requests to `/api/*` are automatically proxied to the FastAPI server at `http://127.0.0.1:8000`.

---

## 7. CSV Data Ingestion

You can ingest and validate any CSV dataset using the built-in CLI:

```powershell
python -m api.services.data_service data/raw/accident_zones_demo.csv
```

### Ingestion Logic:
1. **Validation**: Checks for required columns (`name`, `state`, `district`, `source`).
2. **Sanitization**: Strips whitespace and normalizes state and district names.
3. **Coordinate Integrity**:
   - Checks that latitude is within `[-90.0, 90.0]` and longitude is within `[-180.0, 180.0]`.
   - Records with invalid/out-of-bounds coordinates have coordinates reset to `NULL` with a logged warning.
   - Legitimate missing coordinates remain `NULL` (coordinates are **never** fabricated).
4. **Deduplication**: Automatically drops duplicate `black_spot_code` or matching location descriptions.
5. **Database Storage**: Upserts clean records to Supabase (or in-memory cache if offline).

---

## 8. Official Government Data Adapter

Official Government road safety data is managed via the adapter pattern in [`api/services/official_data_service.py`](./api/services/official_data_service.py).

### Adapter Interface (`OfficialDataSource`):
- `fetch_data()`: Reads verified datasets deposited in `data/official/`.
- `normalize_data(raw_data)`: Maps MoRTH and OGD India column nomenclatures (e.g. `Black Spot ID` -> `black_spot_code`, `Location Description` -> `name`, `NH No` -> `highway`).
- `validate_data(df)`: Verifies data integrity and reports anomalies.
- `convert_to_accident_zones(df)`: Outputs standardized dictionaries ready for the database.

### Principles:
- **No Scraping & No Invented APIs**: We do not guess or scrape unpublished endpoints.
- **Future-Proof**: When official API credentials or OAuth tokens are provided by a government authority, only the `fetch_data()` method of the adapter needs to be wired to the HTTP client. The rest of the application remains unchanged.
- **Legal Compliance**: Standard application phrasing is:
  > *"Approaching an officially identified accident-prone / black-spot location."*

---

## 9. API Endpoints

### 1. `GET /api/zones`
Retrieve active accident zones with optional filters.

**Query Parameters:**
- `state` (optional string): Filter by state substring (e.g. `Haryana`)
- `district` (optional string): Filter by district substring
- `has_coordinates` (optional boolean): Filter for records with GPS (`true`) or without GPS (`false`)
- `limit` (optional integer, default 100, max 500): Pagination limit
- `offset` (optional integer, default 0): Pagination offset

**Example Response:**
```json
{
  "zones": [
    {
      "id": "c83b7ff4-c2c6-4dd8-9104-bb75de87d903",
      "name": "DEMO DATA - Rajiv Chowk Junction",
      "state": "Haryana",
      "district": "Gurugram",
      "highway": "NH-48",
      "road_type": "National Highway",
      "black_spot_code": "DEMO-HR-001",
      "latitude": 28.459497,
      "longitude": 77.026638,
      "accident_count": 42,
      "fatalities": 14,
      "severity": "High",
      "official_priority": "Priority 1",
      "warning_radius": 500,
      "source": "DEMO DATA - Sample Black Spot Protocol",
      "source_url": "https://morth.nic.in/road-accident-in-india",
      "source_date": "2023-03-31",
      "location_source": "VERIFIED_DERIVED",
      "location_accuracy": "EXACT",
      "is_active": true
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

### 2. `GET /api/zones/{zone_id}`
Retrieve a single zone by UUID. Returns `404 Not Found` if the zone does not exist.

### 3. `GET /api/zones/stats`
Retrieve aggregated system metrics.

**Example Response:**
```json
{
  "total_zones": 8,
  "zones_with_coordinates": 5,
  "zones_without_coordinates": 3,
  "total_fatalities": 85,
  "total_accidents": 269,
  "states_count": 4,
  "states_represented": [
    "Haryana",
    "Karnataka",
    "Maharashtra",
    "Tamil Nadu"
  ]
}
```

---

## 10. Automated Test Suite

Run backend test verification using `pytest`:

```powershell
python -m pytest tests/ -v
```

All 19 tests verify:
- Required CSV column validation and normalization
- Preservation of NULL coordinates for textual-only descriptions
- Rejection and reset of out-of-range / fake coordinates
- Deduplication of black spot codes and location names
- MoRTH adapter column normalization and legal provenance
- FastAPI routes (`/`, `/api/health`, `/api/zones`, filters, stats, 404)
