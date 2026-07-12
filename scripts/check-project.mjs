import fs from "fs";
import path from "path";

const root = process.cwd();
const ignoredDirs = new Set([".git", "node_modules", "work", "outputs", ".agents"]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs"]);
const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".css",
  ".md",
  ".json",
  ".html"
]);
const sourceFiles = [];
const textFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const extension = path.extname(fullPath);

    if (sourceExtensions.has(extension)) sourceFiles.push(fullPath);
    if (textExtensions.has(extension) || path.basename(fullPath) === ".env.example") {
      textFiles.push(fullPath);
    }
  }
}

function resolveAliasImport(specifier) {
  const relative = specifier.slice(2);
  const base = path.join(root, "src", relative);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx")
  ];

  return candidates.some((candidate) => fs.existsSync(candidate));
}

walk(root);

const missingImports = [];
const importPattern = /from\s+["'](@\/[^"']+)["']/g;

for (const file of sourceFiles) {
  const content = fs.readFileSync(file, "utf8");
  let match;

  while ((match = importPattern.exec(content))) {
    if (!resolveAliasImport(match[1])) {
      missingImports.push(`${path.relative(root, file)} -> ${match[1]}`);
    }
  }
}

const mojibakeFiles = [];
const suspiciousSecretFiles = [];
const secretPatterns = [
  /BEGIN [A-Z ]*PRIVATE KEY/,
  /AIza[0-9A-Za-z_-]{20,}/,
  /ya29\./,
  /sk-[A-Za-z0-9]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/
];

for (const file of textFiles) {
  const content = fs.readFileSync(file, "utf8");

  if (content.includes("\u05f3")) {
    mojibakeFiles.push(path.relative(root, file));
  }

  if (secretPatterns.some((pattern) => pattern.test(content))) {
    suspiciousSecretFiles.push(path.relative(root, file));
  }
}

const checks = [
  ["Alias imports", missingImports],
  ["Mojibake marker", mojibakeFiles],
  ["Obvious secret values", suspiciousSecretFiles]
];

let failed = false;

for (const [label, findings] of checks) {
  if (findings.length) {
    failed = true;
    console.error(`${label}:`);
    console.error(findings.join("\n"));
  } else {
    console.log(`${label}: ok`);
  }
}

if (failed) {
  process.exitCode = 1;
}
