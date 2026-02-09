import type { Affiliation, UnitType, Echelon } from "../types/unit";

/**
 * MVP: mapping très simple pour la démo.
 * On pourra raffiner plus tard (status, HQ, mobilité, etc).
 */
export function sidcFor(aff: Affiliation, type: UnitType, echelon: Echelon): string {
  // NOTE: codes “démo” — le but ici est d’avoir un rendu cohérent et extensible.
  // Si tu as une table SIDC précise, on remplacera ce mapping.
  const affCode = aff === "FRIEND" ? "F" : aff === "HOSTILE" ? "H" : "N";

  // “typeCode” arbitraire MVP (on ajustera)
  const typeCode = type === "INFANTRY" ? "INF" : type === "ARMOR" ? "ARM" : type === "ARTILLERY" ? "ART" : "UAS";

  // idem echelon
  const echCode = echelon === "SECTION" ? "SEC" : echelon === "BATTALION" ? "BN" : "BDE";

  // Pour milsymbol, idéalement on met un vrai SIDC.
  // Ici on retourne une string stable qui servira déjà à afficher/varier.
  // Prochaine itération: vraie composition SIDC APP-6.
  return `${affCode}-${typeCode}-${echCode}`;
}
