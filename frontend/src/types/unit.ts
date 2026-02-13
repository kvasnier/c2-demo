export type Affiliation = "FRIEND" | "HOSTILE" | "NEUTRAL" | "UNKNOWN";
export type UnitType =
  | "INFANTRY"
  | "ARMOR"
  | "ARTILLERY"
  | "COMMAND_POST"
  | "UAS"
  | "UAS_RECON"
  | "UAS_ATTACK"
  | "UAS_VTOL";
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
