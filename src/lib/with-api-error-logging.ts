import "server-only";
import { logServerError } from "./log-server-error.ts";
import { RequestLimitError } from "./security/request-limit-error.ts";

export function withApiErrorLogging(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const context = { method: request.method, path: new URL(request.url).pathname };
    let response: Response;
    try {
      response = await handler(request);
    } catch (error) {
      if (error instanceof RequestLimitError) {
        logServerError({ ...context, status: error.status, stage: "request admission" }, error);
        return Response.json({ error: error.message }, {
          status: error.status,
          headers: { "Retry-After": String(error.retryAfterSeconds), "Cache-Control": "no-store" },
        });
      }
      logServerError({ ...context, status: 500 }, error);
      throw error;
    }
    if (response.status === 429) {
      // Better Auth uses X-Retry-After; expose the standard header consistently.
      const retryAfter = response.headers.get("retry-after") ?? response.headers.get("x-retry-after");
      const headers = new Headers(response.headers);
      if (retryAfter) headers.set("Retry-After", retryAfter);
      headers.set("Cache-Control", "no-store");
      response = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
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
