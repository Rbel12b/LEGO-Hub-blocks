import { useCallback } from "react";
import { useApp } from "../state/store";
import { BlocklyView } from "./BlocklyView";
import { MonacoView } from "../editor/MonacoView";
import { ConsolePanel } from "./ConsolePanel";

export function Workspace() {
  const { project, setProject, setPythonPreview, pythonPreview } = useApp();

  const onBlockChange = useCallback(
    (state: unknown, python: string) => {
      setPythonPreview(python);
      const current = useApp.getState().project;
      if (current.type === "blocks") {
        setProject({ ...current, workspace: state });
      }
    },
    [setProject, setPythonPreview],
  );

  const onPythonChange = (source: string) => {
    if (project.type !== "python") return;
    setProject({ ...project, source });
  };

  if (project.type === "blocks") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gridTemplateRows: "1fr 30%", height: "100%", gap: 1, background: "#333" }}>
        <div style={{ background: "#f0f0f0" }}>
          <BlocklyView
            initialState={project.workspace}
            showAdvanced={project.settings.showAdvanced}
            onChange={onBlockChange}
          />
        </div>
        <div style={{ background: "#1e1e1e" }}>
          <MonacoView value={pythonPreview} readOnly />
        </div>
        <div style={{ gridColumn: "1 / span 2" }}>
          <ConsolePanel />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateRows: "1fr 30%", height: "100%", gap: 1, background: "#333" }}>
      <div style={{ background: "#1e1e1e" }}>
        <MonacoView value={project.source} onChange={onPythonChange} />
      </div>
      <div>
        <ConsolePanel />
      </div>
    </div>
  );
}
