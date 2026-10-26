import type { RequestHandler } from "express";
import { HttpError } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Second line of CSRF defence after SameSite cookies: browsers always send an Origin
 * header on cross-origin writes, so any write whose Origin is a different site is refused.
 * Requests without an Origin header (curl, server-to-server) carry no cookies from a
 * victim's browser and are allowed through to normal authentication.
 */
export function requireSameOrigin(extraOrigins: string[] = []): RequestHandler {
  const allowed = new Set(extraOrigins);
  return (req, _res, next) => {
    const origin = req.get("origin");
    if (!origin || SAFE_METHODS.has(req.method)) return next();
    const self = `${req.protocol}://${req.get("host")}`;
    if (origin === self || allowed.has(origin)) return next();
    next(new HttpError(403, "Cross-origin request blocked"));
  };
}
