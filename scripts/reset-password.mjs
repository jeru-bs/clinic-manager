import { createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline/promises";
import { stdin, stdout, stderr, exit } from "process";

const envPath = ".env.local";

function hashPassword(password) {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

function quoteEnvValue(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function upsertEnvValue(content, name, value) {
  const replacement = `${name}=${quoteEnvValue(value)}`;
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim().startsWith(`${name}=`));

  if (index === -1) {
    const trimmed = content.trimEnd();
    return `${trimmed}${trimmed ? "\n" : ""}${replacement}\n`;
  }

  lines[index] = replacement;
  return `${lines.join("\n").trimEnd()}\n`;
}

if (!stdin.isTTY) {
  stderr.write("This command must be run in an interactive terminal.\n");
  exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });

try {
  const password = await rl.question("New clinic password: ");
  const confirmation = await rl.question("Repeat password: ");

  if (!password) {
    stderr.write("Password cannot be empty.\n");
    exit(1);
  }

  if (password !== confirmation) {
    stderr.write("Passwords do not match.\n");
    exit(1);
  }

  const currentContent = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const nextContent = upsertEnvValue(
    currentContent,
    "APP_PASSWORD_HASH",
    hashPassword(password)
  );

  writeFileSync(envPath, nextContent, "utf8");
  stdout.write("APP_PASSWORD_HASH updated in .env.local\n");
} finally {
  rl.close();
}
