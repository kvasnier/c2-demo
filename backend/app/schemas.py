from pydantic import BaseModel, Field
from typing import Literal
from uuid import UUID

class UnitCreate(BaseModel):
  name: str
  side: Literal["FRIEND", "ENEMY", "NEUTRAL"]
  unit_type: str = Field(..., description="Infantry, Armor, DroneTeam, etc.")
  lat: float
  lon: float

class POICreate(BaseModel):
  label: str
  category: str
  lat: float
  lon: float

class IdResponse(BaseModel):
  id: UUID
