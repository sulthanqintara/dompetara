import "server-only";
import { logServerError } from "./log-server-error.ts";

export function withApiErrorLogging(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const context = { method: request.method, path: new URL(request.url).pathname };
    let response: Response;
    try {
      response = await handler(request);
    } catch (error) {
      logServerError({ ...context, status: 500 }, error);
      throw error;
    }
    if (response.status >= 400) {
      const body = response.headers.get("content-type")?.includes("application/json")
        ? await response.clone().json().catch(() => null)
        : null;
      const message = typeof body?.error === "string" ? body.error
        : typeof body?.message === "string" ? body.message
        : typeof body?.error?.message === "string" ? body.error.message
        : response.statusText || "API request failed";
      logServerError({ ...context, status: response.status }, message);
    }
    return response;
  };
}
