-- ==============================================================================
-- Accidental Zone Reminder System - Database Schema
-- Target: Supabase PostgreSQL
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create accident_zones table
CREATE TABLE IF NOT EXISTS accident_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    highway VARCHAR(100),
    road_type VARCHAR(100),
    black_spot_code VARCHAR(100),
    latitude NUMERIC(10, 7),             -- MUST BE NULLABLE: Do not invent coordinates
    longitude NUMERIC(10, 7),            -- MUST BE NULLABLE: Do not invent coordinates
    accident_count INTEGER,
    fatalities INTEGER,
    severity VARCHAR(50),
    official_priority VARCHAR(50),
    warning_radius INTEGER DEFAULT 500,  -- Radius in meters for future alert module
    source VARCHAR(150) NOT NULL,        -- e.g. "MORTH_BLACK_SPOT"
    source_url TEXT,
    source_date DATE,
    data_period_start DATE,
    data_period_end DATE,
    location_source VARCHAR(50) DEFAULT 'UNKNOWN' NOT NULL,
    location_accuracy VARCHAR(50) DEFAULT 'UNKNOWN' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    -- Constraints
    CONSTRAINT chk_location_source CHECK (
        location_source IN ('OFFICIAL', 'VERIFIED_DERIVED', 'UNKNOWN')
    ),
    CONSTRAINT chk_location_accuracy CHECK (
        location_accuracy IN ('EXACT', 'APPROXIMATE', 'UNKNOWN')
    ),
    CONSTRAINT chk_latitude_range CHECK (
        latitude IS NULL OR (latitude >= -90.0 AND latitude <= 90.0)
    ),
    CONSTRAINT chk_longitude_range CHECK (
        longitude IS NULL OR (longitude >= -180.0 AND longitude <= 180.0)
    )
);

-- 2. Indexes for performance & future proximity lookups
-- Index on valid coordinates for future spatial/bounding box queries
CREATE INDEX IF NOT EXISTS idx_accident_zones_coords 
    ON accident_zones (latitude, longitude) 
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Filter indexes for common regional queries
CREATE INDEX IF NOT EXISTS idx_accident_zones_state 
    ON accident_zones (state);

CREATE INDEX IF NOT EXISTS idx_accident_zones_district 
    ON accident_zones (district);

CREATE INDEX IF NOT EXISTS idx_accident_zones_black_spot_code 
    ON accident_zones (black_spot_code);

CREATE INDEX IF NOT EXISTS idx_accident_zones_is_active 
    ON accident_zones (is_active);

-- 3. Automatic updated_at timestamp trigger
CREATE OR REPLACE FUNCTION update_accident_zones_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_accident_zones_timestamp ON accident_zones;
CREATE TRIGGER trg_update_accident_zones_timestamp
    BEFORE UPDATE ON accident_zones
    FOR EACH ROW
    EXECUTE FUNCTION update_accident_zones_timestamp();

-- 4. Supabase Row Level Security (RLS) Configuration
ALTER TABLE accident_zones ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for API consumption)
DROP POLICY IF EXISTS "Allow public read-only access to accident zones" ON accident_zones;
CREATE POLICY "Allow public read-only access to accident zones"
    ON accident_zones
    FOR SELECT
    USING (true);

-- Allow service role full access for data ingestion/maintenance
DROP POLICY IF EXISTS "Allow service role full access" ON accident_zones;
CREATE POLICY "Allow service role full access"
    ON accident_zones
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
