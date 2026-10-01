import "dotenv/config";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";

const projectRef =
  process.argv[2] ??
  (await readFile("supabase/.temp/project-ref", "utf8")).trim();
if (!/^[a-z]{20}$/.test(projectRef))
  throw new Error("Pass a valid Supabase project reference.");
const projectUrl = `https://${projectRef}.supabase.co`;
const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 1,
  connect_timeout: 10,
});
const temporary = await mkdtemp(join(tmpdir(), "ledger-fx-"));
try {
  // Confirm this database belongs to the selected project before configuring jobs.
  if (!process.env.DATABASE_URL.includes(projectRef))
    throw new Error("Database URL does not match the selected project.");
  await sql`select 1 from public.exchange_rate_cache limit 1`;
  const [existing] =
    await sql`select decrypted_secret from vault.decrypted_secrets where name = 'ledger_fx_refresh_secret'`;
  const secret = existing?.decrypted_secret ?? randomBytes(32).toString("hex");
  const envFile = join(temporary, "secrets.env");
  await writeFile(envFile, `FX_REFRESH_SECRET=${secret}\n`, { mode: 0o600 });
  execFileSync(
    "supabase",
    ["secrets", "set", "--project-ref", projectRef, "--env-file", envFile],
    { stdio: "pipe" },
  );
  execFileSync(
    "supabase",
    [
      "functions",
      "deploy",
      "refresh-exchange-rates",
      "--project-ref",
      projectRef,
      "--use-api",
    ],
    { stdio: "pipe" },
  );
  console.log("Protected exchange-rate refresh function deployed.");
  await sql.begin(async (tx) => {
    if (!existing)
      await tx`select vault.create_secret(${secret}, 'ledger_fx_refresh_secret')`;
    const [urlSecret] =
      await tx`select id from vault.secrets where name = 'ledger_fx_project_url'`;
    if (urlSecret)
      await tx`select vault.update_secret(${urlSecret.id}, ${projectUrl})`;
    else
      await tx`select vault.create_secret(${projectUrl}, 'ledger_fx_project_url')`;
    await tx`select cron.schedule('ledger-exchange-rates', '0 17-19 * * 1-5', $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'ledger_fx_project_url') || '/functions/v1/refresh-exchange-rates',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-refresh-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ledger_fx_refresh_secret')),
        body := '{}'::jsonb, timeout_milliseconds := 45000
      );
    $job$)`;
  });
  const response = await fetch(
    `${projectUrl}/functions/v1/refresh-exchange-rates`,
    {
      method: "POST",
      headers: {
        "x-refresh-secret": secret,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(45000),
    },
  );
  if (!response.ok)
    throw new Error(`Initial rate refresh failed (HTTP ${response.status}).`);
  console.log("Initial refresh:", await response.json());
  console.log(
    "Cron configured: weekdays at 17:00 UTC, with 18:00/19:00 retries; fresh cache skips provider requests.",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
  await sql.end({ timeout: 1 });
}
