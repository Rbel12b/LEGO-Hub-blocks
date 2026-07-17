import { useApp } from "../state/store";

export function ConsolePanel() {
  const entries = useApp((s) => s.console);
  const clear = useApp((s) => s.clearConsole);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#111", color: "#ddd", fontFamily: "monospace", fontSize: 12 }}>
      <div style={{ padding: "4px 8px", background: "#222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Console</span>
        <button type="button" onClick={clear} style={{ background: "transparent", color: "#ccc", border: "1px solid #555", padding: "2px 8px", cursor: "pointer" }}>
          Clear
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "4px 8px", whiteSpace: "pre-wrap" }}>
        {entries.map((e, i) => (
          <div key={i} style={{ color: e.kind === "err" ? "#f88" : e.kind === "info" ? "#8cf" : "#ddd" }}>
            {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}
