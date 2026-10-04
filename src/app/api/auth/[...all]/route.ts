import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { withApiErrorLogging } from "@/lib/with-api-error-logging";

const handlers = toNextJsHandler(auth.handler);
export const GET = withApiErrorLogging(handlers.GET);
export const POST = withApiErrorLogging(handlers.POST);
