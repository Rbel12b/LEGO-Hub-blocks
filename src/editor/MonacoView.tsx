import { useState } from "react";
import Editor, { loader, type Monaco } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useLspClient } from "./lsp/useLspClient";

// @monaco-editor/react defaults to loading Monaco from a CDN, which fails
// offline (and adds a race between mount and provider registration). Point
// the loader at the version bundled with Vite so onMount always fires with
// the same singleton we import types from.
loader.config({ monaco });

interface Props {
  value: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (v: string) => void;
}

export function MonacoView({ value, language = "python", readOnly = false, onChange }: Props) {
  const [monacoNs, setMonacoNs] = useState<Monaco | null>(null);
  const [model, setModel] = useState<monaco.editor.ITextModel | null>(null);

  // LSP is only wired for editable Python buffers (the built-in editor).
  // The read-only preview in blocks mode uses the same component but stays
  // vanilla — passing `null` for the model short-circuits the hook.
  const lspEnabled = language === "python" && !readOnly;
  useLspClient(lspEnabled ? monacoNs : null, lspEnabled ? model : null);

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      theme="vs-dark"
      onChange={(v) => onChange?.(v ?? "")}
      onMount={(editor, m) => {
        setMonacoNs(m);
        setModel(editor.getModel());
      }}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        wordWrap: "on",
      }}
    />
  );
}
