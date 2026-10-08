import { savePreferences } from "@/features/i18n/save-preferences";
import { withApiErrorLogging } from "@/lib/with-api-error-logging";

export const POST = withApiErrorLogging(savePreferences);
