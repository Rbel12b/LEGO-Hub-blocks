import * as Blockly from "blockly/core";
import { useEffect, useRef } from "react";
import { registerAllBlocks } from "../blocks";
import { workspaceToPython } from "../codegen/pythonGen";
import { buildToolbox } from "../blocks/toolbox";
import { friendlyTheme } from "./blocklyTheme";
import "./blockly-theme.css";

registerAllBlocks();

interface Props {
  initialState?: unknown;
  showAdvanced: boolean;
  onChange: (state: unknown, python: string) => void;
}

export function BlocklyView({ initialState, showAdvanced, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const workspace = Blockly.inject(hostRef.current, {
      toolbox: buildToolbox(showAdvanced),
      renderer: "zelos",
      theme: friendlyTheme,
      trashcan: true,
      grid: { spacing: 25, length: 3, colour: "#e2dcce", snap: false },
      zoom: { controls: true, wheel: true, startScale: 0.9, minScale: 0.4, maxScale: 2.0 },
      move: { scrollbars: true, drag: true, wheel: false },
    });
    workspaceRef.current = workspace;
    if (initialState) {
      try {
        Blockly.serialization.workspaces.load(initialState as object, workspace);
      } catch (e) {
        console.warn("Failed to load workspace state", e);
      }
    }
    const listener = () => {
      const state = Blockly.serialization.workspaces.save(workspace);
      const py = workspaceToPython(workspace);
      onChangeRef.current(state, py);
    };
    workspace.addChangeListener(listener);
    // Fire once for initial preview.
    queueMicrotask(listener);
    return () => {
      workspace.removeChangeListener(listener);
      workspace.dispose();
      workspaceRef.current = null;
    };
    // Intentionally do not re-inject on every prop change — see toolbox effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild toolbox when advanced toggle changes.
  useEffect(() => {
    workspaceRef.current?.updateToolbox(buildToolbox(showAdvanced));
  }, [showAdvanced]);

  return <div ref={hostRef} style={{ width: "100%", height: "100%" }} />;
}
