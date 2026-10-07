import { readReceiptImage } from "@/features/receipts/read-receipt-image";
import { withApiErrorLogging } from "@/lib/with-api-error-logging";
export const runtime = "nodejs";
export const GET = withApiErrorLogging(readReceiptImage);
