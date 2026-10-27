import { exchangeRateRequest } from "@/features/exchange-rates/exchange-rate-request";
import { withApiErrorLogging } from "@/lib/with-api-error-logging";

export const GET = withApiErrorLogging(exchangeRateRequest);
