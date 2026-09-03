import js from "@eslint/js";
import globals from "globals";

// Lint covers the static app (docs/), its scripts and tests.
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      "out/**",
      "build/**",
      "work/**",
      "outputs/**"
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
