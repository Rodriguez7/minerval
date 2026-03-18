import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./load-env-file.mjs";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

loadEnvFile(path.join(rootDir, ".env.local"), { override: true });

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(
  npmExecutable,
  ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000"],
  {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
