from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import uuid4
import os

from .db import get_db
from .schemas import UnitCreate, POICreate, IdResponse

app = FastAPI(title="C2 Demo API", version="0.2.0")

cors = os.getenv("CORS_ORIGINS", "http://localhost:5173")
origins = [o.strip() for o in cors.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

# --- Units as GeoJSON ---
@app.get("/units")
def list_units(db: Session = Depends(get_db)):
    sql = text("""
      SELECT id, name, side, unit_type,
             ST_Y(geom::geometry) AS lat,
             ST_X(geom::geometry) AS lon
      FROM units
      ORDER BY created_at DESC
    """)

    rows = db.execute(sql).mappings().all()

    return {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
          "properties": {
            "id": str(r["id"]),
            "name": r["name"],
            "side": r["side"],
            "unit_type": r["unit_type"],
          },
        }
        for r in rows
      ],
    }

@app.post("/units", response_model=IdResponse)
def create_unit(payload: UnitCreate, db: Session = Depends(get_db)):
    new_id = uuid4()

    sql = text("""
      INSERT INTO units (id, name, side, unit_type, geom)
      VALUES (:id, :name, :side, :unit_type, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))
    """)

    db.execute(sql, {
        "id": new_id,
        "name": payload.name,
        "side": payload.side,
        "unit_type": payload.unit_type,
        "lat": payload.lat,
        "lon": payload.lon,
    })
    db.commit()
    return {"id": new_id}


# --- POIs as GeoJSON ---
@app.get("/pois")
def list_pois(db: Session = Depends(get_db)):
    sql = text("""
      SELECT id, label, category,
             ST_Y(geom::geometry) AS lat,
             ST_X(geom::geometry) AS lon
      FROM pois
      ORDER BY created_at DESC
    """)

    rows = db.execute(sql).mappings().all()

    return {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
          "properties": {
            "id": str(r["id"]),
            "label": r["label"],
            "category": r["category"],
          },
        }
        for r in rows
      ],
    }

@app.post("/pois", response_model=IdResponse)
def create_poi(payload: POICreate, db: Session = Depends(get_db)):
    new_id = uuid4()

    sql = text("""
      INSERT INTO pois (id, label, category, geom)
      VALUES (:id, :label, :category, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))
    """)

    db.execute(sql, {
        "id": new_id,
        "label": payload.label,
        "category": payload.category,
        "lat": payload.lat,
        "lon": payload.lon,
    })
    db.commit()
    return {"id": new_id}
