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
  toolboxBlockScale?: number;
  onChange: (state: unknown, python: string) => void;
}

/**
 * Rewrite each toolbox category row to a Scratch-style chip:
 *   colored circle on top, label below. Blockly sets the row's inline
 *   background-color to the category colour; we copy that onto the icon
 *   span and clear the row's own bg so the label sits on a neutral chip.
 */
function styleToolboxCategories(host: HTMLElement) {
  const rows = host.querySelectorAll<HTMLElement>(".blocklyTreeRow");
  rows.forEach((row) => {
    const inline = row.style.backgroundColor;
    if (inline && inline !== "transparent" && !row.dataset.chipDone) {
      const icon = row.querySelector<HTMLElement>(".blocklyTreeIcon");
      if (icon) icon.style.backgroundColor = inline;
      row.dataset.chipDone = "1";
      row.style.backgroundColor = "transparent";
    }
  });
}

function applyFlyoutScale(workspace: Blockly.WorkspaceSvg, scale: number) {
  const flyout = workspace.getFlyout();
  if (!flyout) return;
  // Override the per-instance scale getter so category re-shows respect it.
  (flyout as unknown as { getFlyoutScale: () => number }).getFlyoutScale = () => scale;
  const inner = flyout.getWorkspace();
  inner.setScale(scale);
  try {
    (flyout as unknown as { reflow?: () => void }).reflow?.();
    (flyout as unknown as { position?: () => void }).position?.();
  } catch { /* ignore */ }
}

export function BlocklyView({ initialState, showAdvanced, toolboxBlockScale = 1, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const scaleRef = useRef(toolboxBlockScale);
  scaleRef.current = toolboxBlockScale;

  useEffect(() => {
    if (!hostRef.current) return;
    const host = hostRef.current;
    const workspace = Blockly.inject(host, {
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

    // Initial toolbox chip styling + flyout scale.
    const restyle = () => {
      styleToolboxCategories(host);
      applyFlyoutScale(workspace, scaleRef.current);
    };
    queueMicrotask(restyle);

    // Re-apply chip styling if Blockly rewrites tree row bg (e.g. selection).
    const toolboxDiv = host.querySelector<HTMLElement>(".blocklyToolboxDiv");
    const observer = toolboxDiv
      ? new MutationObserver(() => styleToolboxCategories(host))
      : null;
    observer?.observe(toolboxDiv!, { attributes: true, attributeFilter: ["style"], subtree: true, childList: true });

    return () => {
      observer?.disconnect();
      workspace.removeChangeListener(listener);
      workspace.dispose();
      workspaceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild toolbox when advanced toggle changes; re-apply chip + flyout scale.
  useEffect(() => {
    const ws = workspaceRef.current;
    const host = hostRef.current;
    if (!ws || !host) return;
    ws.updateToolbox(buildToolbox(showAdvanced));
    queueMicrotask(() => {
      // Reset the flag so new rows get chip styling.
      host.querySelectorAll<HTMLElement>(".blocklyTreeRow[data-chip-done]").forEach((r) => delete r.dataset.chipDone);
      styleToolboxCategories(host);
      applyFlyoutScale(ws, scaleRef.current);
    });
  }, [showAdvanced]);

  // Apply flyout block scale when setting changes.
  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    applyFlyoutScale(ws, toolboxBlockScale);
  }, [toolboxBlockScale]);

  return <div ref={hostRef} style={{ width: "100%", height: "100%" }} />;
}
