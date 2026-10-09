export class RequestLimitError extends Error {
  readonly status: 429 | 503;
  readonly retryAfterSeconds: number;
  constructor(
    status: 429 | 503,
    retryAfterSeconds: number,
  ) {
    super(status === 429
      ? "Too many requests. Please wait a moment and try again."
      : "Request protection is temporarily unavailable. Please try again later.");
    this.name = "RequestLimitError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
