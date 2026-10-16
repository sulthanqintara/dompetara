import { withApiErrorLogging } from "@/lib/with-api-error-logging";
import { ledgerRequest } from "@/features/ledger/server/ledger-request";
export const GET = withApiErrorLogging(ledgerRequest);
export const POST = withApiErrorLogging(ledgerRequest);
