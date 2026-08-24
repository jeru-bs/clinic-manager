import js from "@eslint/js";
import globals from "globals";

// Lint covers the active static app (docs/), its scripts and tests. The legacy
// Next.js implementation in src/ is an inactive reference and is not linted:
// its lint presets required the removed Next.js toolchain.
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "work/**",
      "outputs/**",
      "tsconfig.tsbuildinfo",
      "src/**"
    ]
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        google: "readonly"
      }
    }
  }
];

export default eslintConfig;
