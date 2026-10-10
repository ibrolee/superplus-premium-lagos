type ErrorLike = {
  message?: unknown;
  error?: unknown;
  details?: unknown;
  hint?: unknown;
  description?: unknown;
  context?: unknown;
};

function cleanMessage(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:service[_-]?role|api[_-]?key|apikey|secret|password|token)\b\s*[:=]\s*[^\s,;]+/gi, (match) => {
      const [label] = match.split(/[:=]/, 1);
      return `${label}: [redacted]`;
    })
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted token]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

function extractMessage(value: unknown): string {
  if (typeof value === "string" && value.trim()) return cleanMessage(value);
  if (value instanceof Error && value.message.trim()) return cleanMessage(value.message);
  if (!value || typeof value !== "object") return "";

  const candidate = value as ErrorLike;
  for (const key of ["error", "message", "details", "hint", "description"] as const) {
    const item = candidate[key];
    if (typeof item === "string" && item.trim()) return cleanMessage(item);
  }
  return "";
}

export function getUserErrorMessage(error: unknown, fallback = "Something went wrong.") {
  return extractMessage(error) || fallback;
}

export async function getFunctionErrorMessage(error: unknown, fallback = "The request could not be completed.") {
  const context = error && typeof error === "object" ? (error as ErrorLike).context : null;

  if (context instanceof Response) {
    try {
      const json = await context.clone().json();
      const serverMessage = extractMessage(json);
      if (serverMessage) return serverMessage;
    } catch {
      try {
        const text = await context.clone().text();
        const serverMessage = extractMessage(text);
        if (serverMessage && !serverMessage.startsWith("<!DOCTYPE") && !serverMessage.startsWith("<html")) {
          return serverMessage;
        }
      } catch {
        // Use the direct error below.
      }
    }
  }

  return getUserErrorMessage(error, fallback);
}
