import "server-only";
import { z } from "zod";

const bucket = "receipt-images";

// Native fetch keeps the service credential entirely on the server. Object
// names contain random IDs, never merchant names or original filenames.
export async function receiptImageStorage(
  method: "GET" | "POST" | "DELETE",
  id: string | string[],
  bytes?: Buffer,
) {
  const ids = z
    .array(z.uuid())
    .min(1)
    .max(50)
    .parse(Array.isArray(id) ? id : [id]);
  if (method !== "DELETE" && ids.length !== 1)
    throw new Error("Invalid storage request.");
  const origin = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key)
    throw new Error(
      "Private receipt storage is not configured. Try saving without the image.",
    );
  const deleting = method === "DELETE";
  const response = await fetch(
    `${origin.replace(/\/$/, "")}/storage/v1/object/${method === "GET" ? "authenticated/" : ""}${bucket}${deleting ? "" : `/${ids[0]}.jpg`}`,
    {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(deleting
          ? { "Content-Type": "application/json" }
          : bytes
            ? { "Content-Type": "image/jpeg", "Cache-Control": "max-age=0" }
            : {}),
      },
      ...(deleting
        ? { body: JSON.stringify({ prefixes: ids.map((id) => `${id}.jpg`) }) }
        : bytes
          ? { body: new Uint8Array(bytes) }
          : {}),
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
