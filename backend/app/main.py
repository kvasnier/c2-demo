from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import Any, Dict
from uuid import uuid4
from app.routes.chat import router as chat_router
import asyncpg
import asyncio
import os
from datetime import datetime, timezone

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://c2:c2@db:5432/c2")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
SCENARIO_SQL_PATH = os.getenv("SCENARIO_SQL_PATH", "/scenario/010_scenario_units.sql")
SCENARIO_BACKUP_DIR = os.getenv("SCENARIO_BACKUP_DIR", "/tmp/c2-scenario-backups")
APP_BOOT_ID = datetime.now(timezone.utc).isoformat()

app = FastAPI()

allow_origins = [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Chat router
app.include_router(chat_router)

SIDE_VALUES = ("FRIEND", "ENEMY", "NEUTRAL", "UNKNOWN")
UNIT_TYPE_VALUES = (
    "INFANTRY",
    "ARMOR",
    "ARTILLERY",
    "COMMAND_POST",
    "UAS",
    "UAS_ATTACK",
    "UAS_BOMBER",
    "UAS_CARGO",
    "UAS_COMMAND_POST",
    "UAS_FIGHTER",
    "UAS_CSAR",
    "UAS_JAMMER",
    "UAS_TANKER",
    "UAS_VTOL",
    "UAS_SOF",
    "UAS_MCM",
    "UAS_ASUW",
    "UAS_PATROL",
    "UAS_RECON",
    "UAS_AEW",
    "UAS_ESM",
    "UAS_PHOTOGRAPHIC",
    "UAS_ASW",
    "UAS_TRAINER",
    "UAS_UTILITY",
    "UAS_COMM",
    "UAS_MEDEVAC",
)
ECHELON_VALUES = ("SECTION", "BATTALION", "BRIGADE")

SIDE_SQL = ", ".join(f"'{v}'" for v in SIDE_VALUES)
UNIT_TYPE_SQL = ", ".join(f"'{v}'" for v in UNIT_TYPE_VALUES)
ECHELON_SQL = ", ".join(f"'{v}'" for v in ECHELON_VALUES)

class UnitCreate(BaseModel):
    name: str
    side: str
    unit_type: str
    echelon: str
    sidc: str
    lat: float
    lon: float

    @field_validator("side")
    @classmethod
    def validate_side(cls, value: str) -> str:
        v = value.strip().upper()
        if v == "ENNEMY":
            v = "ENEMY"
        if v == "UKNOWN":
            v = "UNKNOWN"
        if v not in SIDE_VALUES:
            raise ValueError(f"Invalid side: {value}")
        return v

    @field_validator("unit_type")
    @classmethod
    def validate_unit_type(cls, value: str) -> str:
        v = value.strip().upper().replace("-", "_").replace(" ", "_")
        if v == "UAV":
            v = "UAS"
        if v in ("CP", "HQ"):
            v = "COMMAND_POST"
        if v not in UNIT_TYPE_VALUES:
            raise ValueError(f"Invalid unit_type: {value}")
        return v

    @field_validator("echelon")
    @classmethod
    def validate_echelon(cls, value: str) -> str:
        v = value.strip().upper()
        if v not in ECHELON_VALUES:
            raise ValueError(f"Invalid echelon: {value}")
        return v

async def get_conn():
    return await asyncpg.connect(DATABASE_URL)

async def get_conn_with_retry(
    retries: int = 20,
    delay_seconds: float = 1.0,
) -> asyncpg.Connection:
    last_error: Exception | None = None
    for _ in range(retries):
        try:
            return await get_conn()
        except Exception as exc:
            last_error = exc
            await asyncio.sleep(delay_seconds)
    if last_error is not None:
        raise last_error
    raise RuntimeError("Unable to connect to database")

@app.on_event("startup")
async def ensure_units_schema():
    conn = await get_conn_with_retry()
    try:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS postgis")
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS units (
              id UUID PRIMARY KEY,
              name TEXT NOT NULL,
              side TEXT NOT NULL,
              unit_type TEXT NOT NULL,
              echelon TEXT NOT NULL DEFAULT 'SECTION',
              sidc TEXT NOT NULL DEFAULT 'SFGPUCI----C',
              geom geometry(Point, 4326) NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_units_geom ON units USING GIST (geom)")

        await conn.execute("ALTER TABLE units DROP CONSTRAINT IF EXISTS units_side_check")
        await conn.execute("ALTER TABLE units DROP CONSTRAINT IF EXISTS units_unit_type_check")
        await conn.execute("ALTER TABLE units DROP CONSTRAINT IF EXISTS units_echelon_check")
        await conn.execute(
            f"ALTER TABLE units ADD CONSTRAINT units_side_check CHECK (side IN ({SIDE_SQL}))"
        )
        await conn.execute(
            f"ALTER TABLE units ADD CONSTRAINT units_unit_type_check CHECK (unit_type IN ({UNIT_TYPE_SQL}))"
        )
        await conn.execute(
            f"ALTER TABLE units ADD CONSTRAINT units_echelon_check CHECK (echelon IN ({ECHELON_SQL}))"
        )
    finally:
        await conn.close()

def to_feature(row: asyncpg.Record) -> Dict[str, Any]:
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [row["lon"], row["lat"]]},
        "properties": {
            "id": str(row["id"]),
            "name": row["name"],
            "side": row["side"],
            "unit_type": row["unit_type"],
            "echelon": row["echelon"],
            "sidc": row["sidc"],
        },
    }

@app.get("/health")
async def health():
    return {"status": "ok", "boot_id": APP_BOOT_ID}

def load_scenario_insert_statements(path: str) -> list[str]:
    if not os.path.exists(path):
        raise FileNotFoundError(path)

    statements: list[str] = []
    with open(path, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("--"):
                continue
            upper = line.upper()
            if upper.startswith("INSERT INTO PUBLIC.UNITS"):
                statements.append(line if line.endswith(";") else f"{line};")
    return statements

async def dump_units_sql(conn: asyncpg.Connection) -> str:
    rows = await conn.fetch(
        """
        SELECT format(
          'INSERT INTO public.units (id, name, side, unit_type, echelon, sidc, geom, created_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L);',
          id::text,
          name,
          side,
          unit_type,
          echelon,
          sidc,
          encode(ST_AsEWKB(geom), 'hex'),
          created_at::text
        ) AS stmt
        FROM units
        ORDER BY created_at
        """
    )
    lines = [r["stmt"] for r in rows]
    return "\n".join(lines) + ("\n" if lines else "")

@app.post("/scenario/reset")
async def reset_scenario():
    try:
        restore_statements = load_scenario_insert_statements(SCENARIO_SQL_PATH)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=f"Scenario dump not found: {exc}") from exc

    if not restore_statements:
        raise HTTPException(status_code=500, detail="Scenario dump contains no INSERT statements")

    conn = await get_conn()
    try:
        os.makedirs(SCENARIO_BACKUP_DIR, exist_ok=True)
        now = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        backup_path = os.path.join(SCENARIO_BACKUP_DIR, f"units-before-reset-{now}.sql")
        snapshot_sql = await dump_units_sql(conn)
        with open(backup_path, "w", encoding="utf-8") as handle:
            handle.write(snapshot_sql)

        async with conn.transaction():
            await conn.execute("TRUNCATE TABLE units")
            for stmt in restore_statements:
                await conn.execute(stmt)

        restored = await conn.fetchval("SELECT COUNT(*) FROM units")
        return {
            "ok": True,
            "restored_units": int(restored),
            "backup_path": backup_path,
        }
    finally:
        await conn.close()

@app.get("/units")
async def list_units():
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            """
            SELECT
              id, name, side, unit_type, echelon, sidc,
              ST_Y(geom)::float8 AS lat,
              ST_X(geom)::float8 AS lon
            FROM units
            ORDER BY created_at DESC
            """
        )
        return {"type": "FeatureCollection", "features": [to_feature(r) for r in rows]}
    finally:
        await conn.close()

@app.post("/units")
async def create_unit(payload: UnitCreate):
    conn = await get_conn()
    try:
        uid = uuid4()
        await conn.execute(
            """
            INSERT INTO units (id, name, side, unit_type, echelon, sidc, geom)
            VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326))
            """,
            uid,
            payload.name,
            payload.side,
            payload.unit_type,
            payload.echelon,
            payload.sidc,
            payload.lon,  # lon d'abord
            payload.lat,  # puis lat
        )

        # retourne la feature créée
        row = {
            "id": uid,
            "name": payload.name,
            "side": payload.side,
            "unit_type": payload.unit_type,
            "echelon": payload.echelon,
            "sidc": payload.sidc,
            "lat": payload.lat,
            "lon": payload.lon,
        }
        class R(dict):
            def __getitem__(self, k): return dict.get(self, k)
        return to_feature(R(row))
    finally:
        await conn.close()
