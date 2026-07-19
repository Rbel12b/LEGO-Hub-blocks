// VS Code "Dark+" theme port for Monaco.
//
// Monaco ships `vs-dark`, which is Dark+ colours but a much sparser token
// palette — most Python identifiers render in the default foreground so the
// editor looks flat. This theme adds mappings for the token types Monaco's
// Monarch tokenizer actually emits for Python (and other languages we might
// display), so keywords / strings / decorators / builtins get proper colour.
//
// Colour values match VS Code's Default Dark+ theme:
//   https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/dark_plus.json
// Token names come from monaco-editor's Monarch grammars.

import type * as monaco from "monaco-editor";

const RULES: monaco.editor.ITokenThemeRule[] = [
  // Base
  { token: "", foreground: "D4D4D4", background: "1E1E1E" },
  { token: "invalid", foreground: "F44747" },
  { token: "emphasis", fontStyle: "italic" },
  { token: "strong", fontStyle: "bold" },

  // Comments / strings / numbers
  { token: "comment", foreground: "6A9955" },
  { token: "comment.doc", foreground: "6A9955", fontStyle: "italic" },
  { token: "string", foreground: "CE9178" },
  { token: "string.escape", foreground: "D7BA7D" },
  { token: "string.invalid", foreground: "F44747" },
  { token: "regexp", foreground: "D16969" },
  { token: "number", foreground: "B5CEA8" },
  { token: "number.hex", foreground: "B5CEA8" },
  { token: "number.float", foreground: "B5CEA8" },

  // Keywords / control flow
  { token: "keyword", foreground: "C586C0" },
  { token: "keyword.flow", foreground: "C586C0" },
  { token: "keyword.control", foreground: "C586C0" },
  { token: "keyword.control.python", foreground: "C586C0" },
  { token: "keyword.operator", foreground: "D4D4D4" },
  { token: "keyword.other", foreground: "569CD6" },
  { token: "keyword.python", foreground: "C586C0" },
  { token: "keyword.class", foreground: "569CD6" },
  { token: "keyword.class.python", foreground: "569CD6" },
  { token: "keyword.def", foreground: "569CD6" },
  { token: "keyword.def.python", foreground: "569CD6" },
  { token: "storage", foreground: "569CD6" },
  { token: "storage.python", foreground: "569CD6" },
  { token: "storage.type", foreground: "569CD6" },
  { token: "variable.self", foreground: "569CD6", fontStyle: "italic" },
  { token: "variable.self.python", foreground: "569CD6", fontStyle: "italic" },

  // Types / classes
  { token: "type", foreground: "4EC9B0" },
  { token: "type.identifier", foreground: "4EC9B0" },
  { token: "type.identifier.python", foreground: "4EC9B0" },
  { token: "entity.name.type", foreground: "4EC9B0" },
  { token: "entity.name.class", foreground: "4EC9B0" },
  { token: "entity.name.class.python", foreground: "4EC9B0" },

  // Functions / builtins
  { token: "entity.name.function", foreground: "DCDCAA" },
  { token: "entity.name.function.python", foreground: "DCDCAA" },
  { token: "support.function", foreground: "DCDCAA" },
  { token: "predefined", foreground: "4EC9B0" },
  { token: "predefined.python", foreground: "4EC9B0" },
  { token: "annotation.python", foreground: "DCDCAA" },

  // Identifiers
  { token: "identifier", foreground: "9CDCFE" },
  { token: "identifier.python", foreground: "9CDCFE" },
  { token: "variable", foreground: "9CDCFE" },
  { token: "variable.parameter", foreground: "9CDCFE" },
  { token: "variable.other", foreground: "9CDCFE" },

  // Constants
  { token: "constant", foreground: "4FC1FF" },
  { token: "constant.language", foreground: "569CD6" },
  { token: "constant.language.python", foreground: "569CD6" },
  { token: "constant.numeric", foreground: "B5CEA8" },

  // Operators / punctuation
  { token: "operator", foreground: "D4D4D4" },
  { token: "delimiter", foreground: "D4D4D4" },
  { token: "delimiter.parenthesis", foreground: "FFD700" },
  { token: "delimiter.square", foreground: "DA70D6" },
  { token: "delimiter.curly", foreground: "179FFF" },
  { token: "delimiter.angle", foreground: "808080" },

  // Tags / attributes (HTML/JSX/XML — harmless for Python)
  { token: "tag", foreground: "569CD6" },
  { token: "tag.id", foreground: "9CDCFE" },
  { token: "tag.class", foreground: "9CDCFE" },
  { token: "attribute.name", foreground: "9CDCFE" },
  { token: "attribute.value", foreground: "CE9178" },

  // Decorators (@thing in Python)
  { token: "annotation", foreground: "DCDCAA" },

  // JSON keys
  { token: "string.key", foreground: "9CDCFE" },
  { token: "string.value", foreground: "CE9178" },
];

const COLORS: monaco.editor.IColors = {
  "editor.background": "#1E1E1E",
  "editor.foreground": "#D4D4D4",
  "editor.lineHighlightBackground": "#2A2D2E",
  "editor.selectionBackground": "#264F78",
  "editor.inactiveSelectionBackground": "#3A3D41",
  "editorCursor.foreground": "#AEAFAD",
  "editorWhitespace.foreground": "#404040",
  "editorLineNumber.foreground": "#858585",
  "editorLineNumber.activeForeground": "#C6C6C6",
  "editorIndentGuide.background": "#404040",
  "editorIndentGuide.activeBackground": "#707070",
  "editorBracketMatch.background": "#0064001A",
  "editorBracketMatch.border": "#888888",
  "editorHoverWidget.background": "#252526",
  "editorHoverWidget.border": "#454545",
  "editorSuggestWidget.background": "#252526",
  "editorSuggestWidget.border": "#454545",
  "editorSuggestWidget.foreground": "#D4D4D4",
  "editorSuggestWidget.selectedBackground": "#04395E",
  "editorSuggestWidget.selectedForeground": "#FFFFFF",
  "editorSuggestWidget.focusHighlightForeground": "#2AAAFF",
  "editorSuggestWidget.highlightForeground": "#2AAAFF",
  "editorSuggestWidgetStatus.foreground": "#D4D4D4",
  "editorError.foreground": "#F44747",
  "editorWarning.foreground": "#CCA700",
  "editorInfo.foreground": "#3794FF",

  // Suggest-widget symbol icon colours (Dark+ palette). Monaco reads these
  // to tint the icon next to each completion — matches the row of coloured
  // glyphs users expect from VS Code.
  "symbolIcon.arrayForeground": "#75BEFF",
  "symbolIcon.booleanForeground": "#75BEFF",
  "symbolIcon.classForeground": "#EE9D28",
  "symbolIcon.colorForeground": "#75BEFF",
  "symbolIcon.constantForeground": "#75BEFF",
  "symbolIcon.constructorForeground": "#B180D7",
  "symbolIcon.enumeratorForeground": "#EE9D28",
  "symbolIcon.enumeratorMemberForeground": "#75BEFF",
  "symbolIcon.eventForeground": "#EE9D28",
  "symbolIcon.fieldForeground": "#75BEFF",
  "symbolIcon.fileForeground": "#D4D4D4",
  "symbolIcon.folderForeground": "#D4D4D4",
  "symbolIcon.functionForeground": "#B180D7",
  "symbolIcon.interfaceForeground": "#75BEFF",
  "symbolIcon.keyForeground": "#75BEFF",
  "symbolIcon.keywordForeground": "#D670D6",
  "symbolIcon.methodForeground": "#B180D7",
  "symbolIcon.moduleForeground": "#D4D4D4",
  "symbolIcon.namespaceForeground": "#D4D4D4",
  "symbolIcon.nullForeground": "#75BEFF",
  "symbolIcon.numberForeground": "#75BEFF",
  "symbolIcon.objectForeground": "#75BEFF",
  "symbolIcon.operatorForeground": "#75BEFF",
  "symbolIcon.packageForeground": "#75BEFF",
  "symbolIcon.propertyForeground": "#75BEFF",
  "symbolIcon.referenceForeground": "#75BEFF",
  "symbolIcon.snippetForeground": "#75BEFF",
  "symbolIcon.stringForeground": "#75BEFF",
  "symbolIcon.structForeground": "#75BEFF",
  "symbolIcon.textForeground": "#D4D4D4",
  "symbolIcon.typeParameterForeground": "#75BEFF",
  "symbolIcon.unitForeground": "#75BEFF",
  "symbolIcon.variableForeground": "#75BEFF",
};

export const DARK_PLUS_THEME: monaco.editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: RULES,
  colors: COLORS,
};

export const DARK_PLUS_NAME = "dark-plus";

/**
 * Register the theme with a Monaco namespace. Idempotent — safe to call on
 * every editor mount.
 */
export function registerDarkPlus(m: typeof monaco): void {
  m.editor.defineTheme(DARK_PLUS_NAME, DARK_PLUS_THEME);
}
