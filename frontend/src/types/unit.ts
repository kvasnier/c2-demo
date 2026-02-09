export type Affiliation = "FRIEND" | "HOSTILE" | "NEUTRAL";
export type UnitType = "INFANTRY" | "ARMOR" | "ARTILLERY" | "UAS";
export type Echelon = "SECTION" | "BATTALION" | "BRIGADE";

export type Unit = {
  id: string;
  name: string;
  affiliation: Affiliation;
  unit_type: UnitType;
  echelon: Echelon;
  sidc: string;
  lat: number;
  lng: number;
};
