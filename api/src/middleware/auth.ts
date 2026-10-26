import type { Request, RequestHandler } from "express";
import { readCookie, SESSION_COOKIE } from "../lib/cookies.js";
import { HttpError } from "../lib/errors.js";
import type { SessionRepository } from "../lib/sessionRepository.js";
import type { User } from "../lib/userRepository.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

/** Reject the request with 401 unless it carries a valid, unexpired session cookie. */
export function requireAuth(sessions: SessionRepository): RequestHandler {
  return async (req, _res, next) => {
    const token = readCookie(req, SESSION_COOKIE);
    const user = token ? await sessions.findUser(token) : null;
    if (!user) throw new HttpError(401, "Authentication required");
    req.user = user;
    next();
  };
}

/** The signed-in user. Only call this in handlers mounted behind requireAuth. */
export function currentUser(req: Request): User {
  if (!req.user) throw new HttpError(401, "Authentication required");
  return req.user;
}
