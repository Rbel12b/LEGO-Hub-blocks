import { useApp } from "../state/store";
import { downloadProject, pickFile } from "../project/download";
import type { AnyProject } from "../project/format";
import { newBlocksProject, newPythonProject } from "../project/format";

interface Props {
  onOpenSettings: () => void;
}

export function Header({ onOpenSettings }: Props) {
  const { project, setProject } = useApp();

  const rename = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProject({ ...project, title: e.target.value });
  };

  const toggleType = () => {
    setProject(
      project.type === "blocks"
        ? { ...newPythonProject(project.title), settings: project.settings }
        : { ...newBlocksProject(project.title), settings: project.settings },
    );
  };

  const openFile = async () => {
    const file = await pickFile(".json,.blocksproj.json,.py");
    if (!file) return;
    const text = await file.text();
    if (file.name.endsWith(".py")) {
      setProject({
        ...newPythonProject(file.name.replace(/\.py$/, "")),
        source: text,
      });
    } else {
      try {
        const p = JSON.parse(text) as AnyProject;
        setProject(p);
      } catch (e) {
        alert("Invalid project file: " + (e as Error).message);
      }
    }
  };

  const toggleAdvanced = () => {
    useApp.getState().updateSettings({ showAdvanced: !project.settings.showAdvanced });
  };

  return (
    <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "#0f0f10", color: "#eee", borderBottom: "1px solid #333" }}>
      <strong>LEGO-Hub-blocks</strong>
      <input
        value={project.title}
        onChange={rename}
        style={{ background: "#222", color: "#eee", border: "1px solid #444", padding: "4px 8px", borderRadius: 4, width: 220 }}
        aria-label="project title"
      />
      <button type="button" onClick={toggleType} style={btnStyle}>
        Mode: {project.type === "blocks" ? "Blocks" : "Python"}
      </button>
      {project.type === "blocks" && (
        <button type="button" onClick={toggleAdvanced} style={btnStyle}>
          {project.settings.showAdvanced ? "Advanced ✓" : "Advanced"}
        </button>
      )}
      <button type="button" onClick={openFile} style={btnStyle}>Open</button>
      <button type="button" onClick={() => downloadProject(project)} style={btnStyle}>Save</button>
      <button type="button" onClick={onOpenSettings} style={{ ...btnStyle, marginLeft: "auto" }}>Settings</button>
    </header>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "4px 10px",
  border: "1px solid #444",
  background: "#2a2a2a",
  color: "#eee",
  cursor: "pointer",
  borderRadius: 4,
};
