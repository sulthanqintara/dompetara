import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const { loadEnvConfig } = nextRequire("@next/env");
loadEnvConfig(process.cwd(), true);

const missing = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
].filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing local configuration: ${missing.join(", ")}. Set these in .env.local (see .env.example).`);
  process.exit(1);
}

let status;
try {
  status = JSON.parse(execFileSync("tailscale", ["status", "--json"], { encoding: "utf8" }));
} catch {
  console.error("Unable to read Tailscale. Start Tailscale and connect this Mac and your tablet to the same tailnet.");
  process.exit(1);
}
const hostname = status.Self?.DNSName?.replace(/\.$/, "");
if (status.BackendState !== "Running" || !hostname) {
  console.error("Connect Tailscale before starting tablet development.");
  process.exit(1);
}

// A separate HTTPS port avoids replacing another app served on port 443.
const origin = `https://${hostname}:8443`;
try {
  execFileSync("tailscale", ["serve", "--bg", "--https=8443", "http://127.0.0.1:3000"], { stdio: "inherit" });
} catch {
  console.error("Unable to start Tailscale Serve. Enable HTTPS in your tailnet if prompted, then retry.");
  process.exit(1);
}

console.log(`\nOpen on your Poco Pad: ${origin}`);
console.log(`Google OAuth JavaScript origin: ${origin}`);
console.log(`Google OAuth redirect URI: ${origin}/api/auth/callback/google`);
console.log("Keep Tailscale connected on both devices. Stop the proxy with: tailscale serve --https=8443 off\n");

const dev = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--hostname", "0.0.0.0", "--port", "3000"], {
  stdio: "inherit",
  env: { ...process.env, BETTER_AUTH_URL: origin, DEV_APP_URL: origin },
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => dev.kill(signal));
}
dev.on("error", (error) => {
  console.error("Unable to start the dev server:", error.message);
  process.exitCode = 1;
});
dev.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
