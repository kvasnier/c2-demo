type Props = {
  onAddUnit: () => void;
};

export function RightToolbar({ onAddUnit }: Props) {
  return (
    <div style={{
      position: "absolute",
      right: 12,
      top: 72,
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      gap: 10
    }}>
      <button onClick={onAddUnit} style={btnStyle}>＋ Unit</button>
      {/* futur: layers, measure, draw, etc */}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(20,24,28,0.85)",
  color: "white",
  cursor: "pointer",
};
