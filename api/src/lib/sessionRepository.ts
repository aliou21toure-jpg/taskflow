import { createHash, randomBytes } from "node:crypto";
import type { Db } from "../db.js";
import type { User } from "./userRepository.js";

/** 32 random bytes = 256 bits of entropy, encoded for use in a cookie. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the SHA-256 of a token is stored, never the token itself. */
export function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

export class SessionRepository {
  constructor(
    private readonly db: Db,
    private readonly ttlHours: number,
  ) {}

  /** Start a new session and return the raw token for the cookie. */
  async create(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + this.ttlHours * 3_600_000);
    await this.db.query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)", [
      userId,
      hashToken(token),
      expiresAt,
    ]);
    // Opportunistic cleanup so expired rows don't pile up.
    await this.db.query("DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()", [userId]);
    return { token, expiresAt };
  }

  /** The user behind a token, or null if the token is unknown or expired. */
  async findUser(token: string): Promise<User | null> {
    const { rows } = await this.db.query<User>(
      `SELECT u.id, u.email, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hashToken(token)],
    );
    return rows[0] ?? null;
  }

  async delete(token: string): Promise<void> {
    await this.db.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  }
}
