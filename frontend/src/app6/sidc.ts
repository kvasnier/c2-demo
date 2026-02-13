import type { Affiliation, UnitType, Echelon } from "../types/unit";

/**
 * MVP: mapping très simple pour la démo.
 * On pourra raffiner plus tard (status, HQ, mobilité, etc).
 */
export function sidcFor(aff: Affiliation, type: UnitType, echelon: Echelon): string {
  const affCode = aff === "FRIEND" ? "F" : aff === "HOSTILE" ? "H" : aff === "NEUTRAL" ? "N" : "U";
  const modifier2 = echelon === "SECTION" ? "C" : echelon === "BATTALION" ? "F" : "H";

  const base =
    type === "INFANTRY"
      ? { dimension: "G", functionId: "UCI---" }
      : type === "ARMOR"
        ? { dimension: "G", functionId: "UCA---" }
        : type === "ARTILLERY"
          ? { dimension: "G", functionId: "UCF---" }
          : type === "COMMAND_POST"
            ? { dimension: "G", functionId: "UH1---" }
            : type === "UAS_RECON"
              ? { dimension: "A", functionId: "MFQR--" }
              : type === "UAS_ATTACK"
                ? { dimension: "A", functionId: "MFQA--" }
                : type === "UAS_VTOL"
                  ? { dimension: "A", functionId: "MFQL--" }
                  : { dimension: "A", functionId: "MFQ---" };

  return `S${affCode}${base.dimension}P${base.functionId}-${modifier2}`;
}
