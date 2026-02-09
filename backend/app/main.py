from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Literal, Any, Dict
from uuid import uuid4
import asyncpg
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://c2:c2@db:5432/c2")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")

app = FastAPI()

allow_origins = [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UnitCreate(BaseModel):
    name: str
    side: Literal["FRIEND", "ENEMY", "NEUTRAL"]
    unit_type: Literal["INFANTRY", "ARMOR", "ARTILLERY", "UAS"]
    echelon: Literal["SECTION", "BATTALION", "BRIGADE"]
    sidc: str
    lat: float
    lon: float

async def get_conn():
    return await asyncpg.connect(DATABASE_URL)

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
