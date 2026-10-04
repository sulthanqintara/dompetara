import { extractRequest } from "@/features/receipts/extract-request";
import { withApiErrorLogging } from "@/lib/with-api-error-logging";
export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = withApiErrorLogging(extractRequest);
