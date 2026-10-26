import { type RequestHandler, type Response, Router } from "express";
import { rateLimit } from "express-rate-limit";
import { readCookie, SESSION_COOKIE, sessionCookieOptions } from "../lib/cookies.js";
import { HttpError } from "../lib/errors.js";
import { getDummyHash, hashPassword, verifyPassword } from "../lib/passwords.js";
import type { SessionRepository } from "../lib/sessionRepository.js";
import { EmailTakenError, type UserRepository } from "../lib/userRepository.js";
import { LoginSchema, RegisterSchema } from "../lib/validation.js";
import { currentUser } from "../middleware/auth.js";

export interface AuthRouterOptions {
  users: UserRepository;
  sessions: SessionRepository;
  requireAuth: RequestHandler;
  cookieSecure: boolean;
  /** Login + register attempts per IP per 15 minutes. */
  rateLimitPerWindow: number;
}

export function authRouter(opts: AuthRouterOptions): Router {
  const { users, sessions, requireAuth, cookieSecure } = opts;
  const router = Router();

  // Slow down password guessing and mass sign-ups. The store is in memory, so on
  // several server instances each one counts separately (see README).
  const limiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: opts.rateLimitPerWindow,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError(429, "Too many attempts. Try again in a few minutes.")),
  });

  async function startSession(res: Response, userId: string): Promise<void> {
    const { token, expiresAt } = await sessions.create(userId);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(cookieSecure, expiresAt));
  }

  router.post("/register", limiter, async (req, res) => {
    const { email, password } = RegisterSchema.parse(req.body);
    let user;
    try {
      user = await users.create(email, await hashPassword(password));
    } catch (err) {
      if (err instanceof EmailTakenError) throw new HttpError(409, "An account with this email already exists");
      throw err;
    }
    await startSession(res, user.id);
    res.status(201).json({ user });
  });

  router.post("/login", limiter, async (req, res) => {
    const { email, password } = LoginSchema.parse(req.body);
    const found = await users.findByEmailWithHash(email);
    // Always run one Argon2 verification so unknown emails take as long as wrong passwords.
    const ok = await verifyPassword(found?.password_hash ?? (await getDummyHash()), password);
    if (!found || !ok) throw new HttpError(401, "Invalid email or password");

    // A fresh token on every login prevents session fixation.
    const old = readCookie(req, SESSION_COOKIE);
    if (old) await sessions.delete(old);
    await startSession(res, found.id);
    res.json({ user: { id: found.id, email: found.email, created_at: found.created_at } });
  });

  router.post("/logout", async (req, res) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) await sessions.delete(token); // the server forgets the session, not just the browser
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(cookieSecure));
    res.status(204).end();
  });

  router.get("/me", requireAuth, (req, res) => {
    res.json({ user: currentUser(req) });
  });

  return router;
}
