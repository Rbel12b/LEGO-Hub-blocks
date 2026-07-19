// Rich Monarch tokenizer for Python.
//
// Monaco's built-in Python tokenizer only emits `keyword` / `string` /
// `number` / `comment` — every identifier falls through to the default
// foreground, so Dark+ can't colour anything. This replacement classifies
// more token categories so the theme's palette actually gets used:
//
//   keyword.control.python  → purple  (`if`, `for`, `while`, `return`, ...)
//   keyword.python          → purple  (`import`, `from`, `as`, `pass`, ...)
//   keyword.def.python      → blue    (`def`)
//   keyword.class.python    → blue    (`class`)
//   storage.python          → blue    (`lambda`, `global`, `nonlocal`)
//   constant.language.python→ blue    (`True`, `False`, `None`)
//   variable.self.python    → blue    (`self`, `cls`)
//   predefined.python       → teal    (builtins like `len`, `print`, ...)
//   type.identifier.python  → teal    (annotations, class references)
//   entity.name.function.python → yellow (function definition names)
//   entity.name.class.python    → teal   (class definition names)
//   annotation.python       → yellow  (decorators like `@staticmethod`)
//   identifier              → light blue (all other names)

import type * as monaco from "monaco-editor";

const KEYWORDS = [
  "and", "as", "assert", "async", "await", "class", "def", "del", "elif",
  "else", "except", "finally", "for", "from", "global", "if", "import", "in",
  "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try",
  "while", "with", "yield", "match", "case",
];

const CONTROL = [
  "if", "elif", "else", "for", "while", "break", "continue", "return",
  "try", "except", "finally", "raise", "with", "yield", "match", "case",
  "pass",
];

const STORAGE = ["lambda", "global", "nonlocal", "del"];

const CONSTANTS = ["True", "False", "None", "NotImplemented", "Ellipsis"];

const SELF_NAMES = ["self", "cls"];

const BUILTINS = [
  "abs", "aiter", "all", "anext", "any", "ascii", "bin", "bool",
  "breakpoint", "bytearray", "bytes", "callable", "chr", "classmethod",
  "compile", "complex", "delattr", "dict", "dir", "divmod", "enumerate",
  "eval", "exec", "filter", "float", "format", "frozenset", "getattr",
  "globals", "hasattr", "hash", "help", "hex", "id", "input", "int",
  "isinstance", "issubclass", "iter", "len", "list", "locals", "map", "max",
  "memoryview", "min", "next", "object", "oct", "open", "ord", "pow",
  "print", "property", "range", "repr", "reversed", "round", "set",
  "setattr", "slice", "sorted", "staticmethod", "str", "sum", "super",
  "tuple", "type", "vars", "zip", "__import__",
];

export const PYTHON_LANGUAGE: monaco.languages.IMonarchLanguage = {
  defaultToken: "",
  tokenPostfix: ".python",

  keywords: KEYWORDS,
  control: CONTROL,
  storage: STORAGE,
  constants: CONSTANTS,
  selfNames: SELF_NAMES,
  builtins: BUILTINS,

  brackets: [
    { open: "(", close: ")", token: "delimiter.parenthesis" },
    { open: "[", close: "]", token: "delimiter.square" },
    { open: "{", close: "}", token: "delimiter.curly" },
  ],

  tokenizer: {
    root: [
      // Whitespace + line comments
      [/[ \t\r\n]+/, "white"],
      [/#.*$/, "comment"],

      // Decorators
      [/@[A-Za-z_][\w.]*/, "annotation"],

      // Class definition — highlight the class name in teal
      [/(class)(\s+)([A-Za-z_]\w*)/, ["keyword.class", "white", "entity.name.class"]],

      // Function definition — highlight the function name in yellow
      [/(def)(\s+)([A-Za-z_]\w*)/, ["keyword.def", "white", "entity.name.function"]],

      // `from X import ...` — module names as types
      [/(from)(\s+)([A-Za-z_][\w.]*)/, ["keyword", "white", "type.identifier"]],
      [/(import)(\s+)([A-Za-z_][\w.]*)/, ["keyword", "white", "type.identifier"]],

      // Type annotations: `: Type` or `-> Type`
      [/(->\s*)([A-Za-z_][\w.]*)/, ["operator", "type.identifier"]],
      [/(:\s*)([A-Za-z_][\w.]*)(?=\s*[,)=\]])/, ["delimiter", "type.identifier"]],

      // Identifier followed by `(` → function call. Runs before the generic
      // identifier rule so `foo(...)` colours `foo` yellow instead of light
      // blue. Keywords still win because we match them explicitly first.
      [
        /[A-Za-z_]\w*(?=\s*\()/,
        {
          cases: {
            "@constants": "constant.language",
            "@selfNames": "variable.self",
            "@storage": "storage",
            "@control": "keyword.control",
            "@keywords": "keyword",
            "@builtins": "predefined",
            "@default": "entity.name.function",
          },
        },
      ],

      // Identifiers (post-classification)
      [
        /[A-Za-z_]\w*/,
        {
          cases: {
            "@constants": "constant.language",
            "@selfNames": "variable.self",
            "@storage": "storage",
            "@control": "keyword.control",
            "@keywords": "keyword",
            "@builtins": "predefined",
            "@default": "identifier",
          },
        },
      ],

      // Numbers
      [/0[xX][0-9a-fA-F]+/, "number.hex"],
      [/0[oO][0-7]+/, "number.octal"],
      [/0[bB][01]+/, "number.binary"],
      [/\d+\.\d*([eE][+-]?\d+)?[jJ]?/, "number.float"],
      [/\.\d+([eE][+-]?\d+)?[jJ]?/, "number.float"],
      [/\d+[eE][+-]?\d+[jJ]?/, "number.float"],
      [/\d+[jJ]?/, "number"],

      // Strings — f-string / r-string prefixes recognized
      [/[bBrRuUfF]{0,2}"""/, "string", "@string_triple_d"],
      [/[bBrRuUfF]{0,2}'''/, "string", "@string_triple_s"],
      [/[bBrRuUfF]{0,2}"/, "string", "@string_d"],
      [/[bBrRuUfF]{0,2}'/, "string", "@string_s"],

      // Delimiters / operators
      [/[()]/, "delimiter.parenthesis"],
      [/[[\]]/, "delimiter.square"],
      [/[{}]/, "delimiter.curly"],
      [/[,;:]/, "delimiter"],
      [/[+\-*/%&|^~<>=!]+/, "operator"],
    ],

    string_d: [
      [/[^\\"]+/, "string"],
      [/\\./, "string.escape"],
      [/"/, "string", "@pop"],
    ],
    string_s: [
      [/[^\\']+/, "string"],
      [/\\./, "string.escape"],
      [/'/, "string", "@pop"],
    ],
    string_triple_d: [
      [/[^\\"]+/, "string"],
      [/\\./, "string.escape"],
      [/"""/, "string", "@pop"],
      [/"/, "string"],
    ],
    string_triple_s: [
      [/[^\\']+/, "string"],
      [/\\./, "string.escape"],
      [/'''/, "string", "@pop"],
      [/'/, "string"],
    ],
  },
};

export const PYTHON_LANGUAGE_CONFIG: monaco.languages.LanguageConfiguration = {
  comments: { lineComment: "#" },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"', notIn: ["string"] },
    { open: "'", close: "'", notIn: ["string", "comment"] },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  indentationRules: {
    increaseIndentPattern: /^\s*(?:class|def|elif|else|except|finally|for|if|try|while|with)\b.*:\s*(?:#.*)?$/,
    decreaseIndentPattern: /^\s*(?:elif|else|except|finally)\b.*:\s*(?:#.*)?$/,
  },
  onEnterRules: [
    {
      beforeText: /:\s*(?:#.*)?$/,
      action: { indentAction: 1 /* Indent */ },
    },
  ],
};

/** Install the rich Python grammar on a Monaco namespace. Idempotent. */
export function registerPythonTokens(m: typeof monaco): void {
  m.languages.setMonarchTokensProvider("python", PYTHON_LANGUAGE);
  m.languages.setLanguageConfiguration("python", PYTHON_LANGUAGE_CONFIG);
}
