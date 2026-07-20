import { useApp } from "../state/store";

export function ConsolePanel() {
  const entries = useApp((s) => s.console);
  const clear = useApp((s) => s.clearConsole);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0b1216", color: "#dff5fb", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
      <div style={{ padding: "4px 10px", background: "#0b3b48", color: "#dff5fb", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #0e7490" }}>
        <span style={{ fontWeight: 700, letterSpacing: 0.3 }}>Console</span>
        <button
          type="button"
          onClick={clear}
          style={{ background: "transparent", color: "#dff5fb", border: "1px solid #0e7490", padding: "2px 10px", cursor: "pointer", borderRadius: 4, fontWeight: 600 }}
        >
          Clear
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "6px 10px", whiteSpace: "pre-wrap" }}>
        {entries.map((e, i) => (
          <div key={i} style={{ color: e.kind === "err" ? "#ff8a8a" : e.kind === "info" ? "#4cc3ff" : "#e6f4fa" }}>
            {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}
