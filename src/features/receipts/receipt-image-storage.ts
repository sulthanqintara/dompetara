import "server-only";
import { z } from "zod";

const bucket = "receipt-images";

// Native fetch keeps the service credential entirely on the server. Object
// names contain random IDs, never merchant names or original filenames.
export async function receiptImageStorage(
  method: "DELETE",
  id: string[],
) {
  const ids = z.array(z.uuid()).min(1).max(50).parse(id);
  const origin = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key)
    throw new Error("Legacy receipt cleanup storage is not configured.");
  const response = await fetch(
    `${origin.replace(/\/$/, "")}/storage/v1/object/${bucket}`,
    {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: ids.map((id) => `${id}.jpg`) }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok)
    throw new Error(
      `Private receipt storage ${method} failed (${response.status}).`,
    );
  return response;
}
