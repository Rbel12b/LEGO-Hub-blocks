import { useState } from "react";
import Editor, { loader, type Monaco } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { useLspClient } from "./lsp/useLspClient";
import { DARK_PLUS_NAME, registerDarkPlus } from "./darkPlusTheme";
import { registerPythonTokens } from "./pythonTokens";

// Monaco spawns web workers for background services (tokenization, diff, etc.).
// Without a MonacoEnvironment hook it warns and falls back to running worker
// code on the main thread, which freezes the UI. Python has no bundled
// language worker — the base editor worker covers everything we use.
(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

// @monaco-editor/react defaults to loading Monaco from a CDN, which fails
// offline (and adds a race between mount and provider registration). Point
// the loader at the version bundled with Vite so onMount always fires with
// the same singleton we import types from.
loader.config({ monaco });
registerDarkPlus(monaco);
registerPythonTokens(monaco);

interface Props {
  value: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (v: string) => void;
}

/**
 * Force the suggest widget's docs side-panel open. Monaco stores the panel's
 * expanded state per-editor in a private "memento" — first show is collapsed
 * unless we intervene. We fire `toggleSuggestionDetails` the first time the
 * widget renders, then let the user's subsequent toggles win.
 */
function expandSuggestDetails(editor: monaco.editor.IStandaloneCodeEditor): void {
  const controller = editor.getContribution("editor.contrib.suggestController") as unknown as {
    widget?: { value?: { onDidShow?: (cb: () => void) => monaco.IDisposable } };
  } | null;
  let expanded = false;
  const doToggle = () => {
    if (expanded) return;
    expanded = true;
    editor.trigger("lsp", "toggleSuggestionDetails", {});
  };
  // The widget lazily initialises on first trigger. Wire onDidShow once
  // available; fall back to a one-shot trigger via editor command.
  const wire = () => {
    const w = controller?.widget?.value;
    if (w?.onDidShow) {
      w.onDidShow(doToggle);
      return true;
    }
    return false;
  };
  if (!wire()) {
    const d = editor.onDidChangeModelContent(() => {
      if (wire()) d.dispose();
    });
  }
}

export function MonacoView({ value, language = "python", readOnly = false, onChange }: Props) {
  const [monacoNs, setMonacoNs] = useState<Monaco | null>(null);
  const [model, setModel] = useState<monaco.editor.ITextModel | null>(null);

  // LSP wires up for any Python buffer, including the read-only preview in
  // blocks mode — hover / diagnostics still work when the model is driven by
  // the block generator instead of typing.
  const lspEnabled = language === "python";
  useLspClient(lspEnabled ? monacoNs : null, lspEnabled ? model : null);

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      theme={DARK_PLUS_NAME}
      onChange={(v) => onChange?.(v ?? "")}
      onMount={(editor, m) => {
        registerDarkPlus(m);
        registerPythonTokens(m);
        setMonacoNs(m);
        setModel(editor.getModel());
        expandSuggestDetails(editor);
      }}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        suggest: {
          showStatusBar: true,
          preview: true,
        },
      }}
    />
  );
}
