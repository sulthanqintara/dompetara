import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 1,
  connect_timeout: 10,
  connection: { application_name: "dompetara-keepalive" },
});

try {
  const [{ now }] = await sql`select now()`;
  console.log(`Supabase database responded at ${now.toISOString()}`);
} finally {
  await sql.end();
}
