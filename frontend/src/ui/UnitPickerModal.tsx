import type { Affiliation, UnitType, Echelon } from "../types/unit";
import { sidcFor } from "../app6/sidc";
import { useMemo, useState } from "react";

type UnitDraft = {
  name: string;
  affiliation: Affiliation;
  unit_type: UnitType;
  echelon: Echelon;
  sidc: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (draft: UnitDraft) => void;
};

export function UnitPickerModal({ open, onClose, onConfirm }: Props) {
  const [name, setName] = useState("New unit");
  const [affiliation, setAffiliation] = useState<Affiliation>("FRIEND");
  const [unitType, setUnitType] = useState<UnitType>("INFANTRY");
  const [echelon, setEchelon] = useState<Echelon>("SECTION");

  const sidc = useMemo(() => sidcFor(affiliation, unitType, echelon), [affiliation, unitType, echelon]);

  if (!open) return null;

  return (
    <div style={backdrop} onMouseDown={onClose}>
      <div style={modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <h3 style={{margin:0}}>Add unit</h3>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <label style={label}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={input} />

        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 12}}>
          <div>
            <label style={label}>Affiliation</label>
            <select value={affiliation} onChange={(e) => setAffiliation(e.target.value as Affiliation)} style={input}>
              <option value="FRIEND">Friend</option>
              <option value="HOSTILE">Hostile</option>
              <option value="NEUTRAL">Neutral</option>
            </select>
          </div>

          <div>
            <label style={label}>Type</label>
            <select value={unitType} onChange={(e) => setUnitType(e.target.value as UnitType)} style={input}>
              <option value="INFANTRY">Infantry</option>
              <option value="ARMOR">Armor</option>
              <option value="ARTILLERY">Artillery</option>
              <option value="UAS">Drone (UAS)</option>
            </select>
          </div>

          <div>
            <label style={label}>Echelon</label>
            <select value={echelon} onChange={(e) => setEchelon(e.target.value as Echelon)} style={input}>
              <option value="SECTION">Section</option>
              <option value="BATTALION">Battalion</option>
              <option value="BRIGADE">Brigade</option>
            </select>
          </div>

          <div>
            <label style={label}>SIDC</label>
            <input value={sidc} readOnly style={{...input, opacity: 0.85}} />
          </div>
        </div>

        <div style={{display:"flex", justifyContent:"flex-end", gap: 10, marginTop: 14}}>
          <button onClick={onClose} style={secondary}>Cancel</button>
          <button
            onClick={() => onConfirm({ name, affiliation, unit_type: unitType, echelon, sidc })}
            style={primary}
          >
            Place on map
          </button>
        </div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  zIndex: 2000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modal: React.CSSProperties = {
  width: 520,
  borderRadius: 16,
  padding: 16,
  background: "rgba(20,24,28,0.95)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.12)",
};

const label: React.CSSProperties = { display:"block", marginTop: 10, marginBottom: 6, opacity: 0.9 };
const input: React.CSSProperties = { width:"100%", padding:"10px 12px", borderRadius: 10, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(0,0,0,0.25)", color:"white" };
const closeBtn: React.CSSProperties = { ...input, width: 40, height: 40, padding: 0, cursor:"pointer" };
const primary: React.CSSProperties = { ...input, width:"auto", cursor:"pointer", background:"rgba(0,120,255,0.35)" };
const secondary: React.CSSProperties = { ...input, width:"auto", cursor:"pointer" };
