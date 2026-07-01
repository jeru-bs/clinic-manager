import { createHash } from "crypto";
import { argv, env, stdin, stdout, stderr, exit } from "process";
import { createInterface } from "readline/promises";

let password = argv[2] || env.PASSWORD_TO_HASH || "";

if (!password && stdin.isTTY) {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    password = await rl.question("Password to hash: ");
  } finally {
    rl.close();
  }
}

if (!password) {
  stderr.write("Usage: npm.cmd run hash-password -- your-password\n");
  exit(1);
}

stdout.write(`${createHash("sha256").update(password, "utf8").digest("hex")}\n`);
