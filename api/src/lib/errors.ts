import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

/** An error that maps directly onto an HTTP response. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route ${req.method} ${req.path} not found`));
};

/**
 * Central error handler. Every error leaves the API in the same JSON shape:
 *   { "error": { "message": string, "details"?: unknown } }
 * Unexpected errors are logged but never leak internals to the client.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: "Validation failed",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, details: err.details } });
    return;
  }
  // Malformed JSON body from express.json()
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: { message: "Request body is not valid JSON" } });
    return;
  }
  req.log?.error({ err }, "unhandled error");
  res.status(500).json({ error: { message: "Internal server error" } });
};
