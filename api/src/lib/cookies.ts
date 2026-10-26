import type { CookieOptions, Request } from "express";

export const SESSION_COOKIE = "tf_session";

/** Read one cookie from the request header (avoids pulling in a cookie-parser dependency). */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/**
 * HttpOnly: page scripts (and any injected XSS) cannot read the token.
 * SameSite=Lax: the browser won't attach it to cross-site POST/PATCH/DELETE requests (CSRF).
 * Secure: HTTPS only, enabled in production.
 */
export function sessionCookieOptions(secure: boolean, expires?: Date): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure, path: "/", ...(expires ? { expires } : {}) };
}
