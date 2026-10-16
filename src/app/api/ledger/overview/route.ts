import { withApiErrorLogging } from "@/lib/with-api-error-logging";
import { queryRequest } from "@/features/ledger/server/query-request";
export const GET = withApiErrorLogging((request) => queryRequest(request, "overview"));
