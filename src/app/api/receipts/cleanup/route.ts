import { cleanupReceiptImages } from "@/features/receipts/cleanup-receipt-images";
import { withApiErrorLogging } from "@/lib/with-api-error-logging";
export const runtime = "nodejs";
export const maxDuration = 300;
export const GET = withApiErrorLogging(async (request: Request) => {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  const result = await cleanupReceiptImages();
  return Response.json(result, {
    status: result.failed ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
});
