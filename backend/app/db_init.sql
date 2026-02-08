CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('FRIEND', 'ENEMY', 'NEUTRAL')),
  unit_type TEXT NOT NULL,
  geom geometry(Point, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pois (
  id UUID PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  geom geometry(Point, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_geom ON units USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_pois_geom ON pois USING GIST (geom);
