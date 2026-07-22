import { useEffect, useState } from "react";
import { Header } from "./ui/Header";
import { DeviceBar } from "./ui/DeviceBar";
import { Workspace } from "./ui/Workspace";
import { SettingsModal } from "./ui/SettingsModal";
import { useApp } from "./state/store";
import { loadAutosave, saveAutosave } from "./project/storage";

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const project = useApp((s) => s.project);
  const loadProject = useApp((s) => s.loadProject);

  useEffect(() => {
    const saved = loadAutosave();
    if (saved) loadProject(saved);
  }, [loadProject]);

  useEffect(() => {
    const id = setInterval(() => saveAutosave(useApp.getState().project), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const s = useApp.getState();
      if (JSON.stringify(s.project) !== s.savedSnapshot) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden", background: project.type === "python" ? "#06090b" : "#eaf4f7" }}>
      <Header onOpenSettings={() => setShowSettings(true)} />
      <DeviceBar />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Workspace key={project.type} />
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
