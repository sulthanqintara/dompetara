import "server-only";

export function logServerError(
  context: Record<string, string | number>,
  error: unknown,
) {
  const message = [error, error instanceof Error ? error.cause : undefined]
    .filter((value) => value !== undefined)
    .map((value) => {
      // SyntaxError messages can quote request/provider JSON; SQL errors can include mutation values.
      if (value instanceof SyntaxError) return "Invalid JSON or syntax.";
      const text = value instanceof Error ? value.message
        : typeof value === "string" ? value : "Unknown error";
      return text.replace(/\nparams:[\s\S]*/, "\nparams: [redacted]");
    })
    .join("\nCaused by: ");
  let entry = JSON.stringify({
    ...context,
    name: error instanceof Error ? error.name : "Error",
    message,
    ...(error instanceof Error && error.stack
      ? { stack: error.stack.split("\n").filter((line) => /^\s+at /.test(line)).join("\n") }
      : {}),
  });
  for (const [name, value] of Object.entries(process.env))
    if (/KEY|SECRET|TOKEN|DATABASE_URL/.test(name) && value && value.length > 6)
      entry = entry.replaceAll(JSON.stringify(value).slice(1, -1), "[redacted]");
  entry = entry.replace(/Bearer\s+[^\s"\\]+/gi, "Bearer [redacted]");
  console.error("[api error]", JSON.parse(entry));
}
