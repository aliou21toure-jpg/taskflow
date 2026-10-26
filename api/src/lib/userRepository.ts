import type { Db } from "../db.js";

export interface User {
  id: string;
  email: string;
  created_at: string;
}

interface UserWithHash extends User {
  password_hash: string;
}

export class EmailTakenError extends Error {}

export class UserRepository {
  constructor(private readonly db: Db) {}

  async create(email: string, passwordHash: string): Promise<User> {
    try {
      const { rows } = await this.db.query<User>(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2)
         RETURNING id, email, created_at`,
        [email, passwordHash],
      );
      return rows[0]!;
    } catch (err) {
      if ((err as { code?: string }).code === "23505") throw new EmailTakenError();
      throw err;
    }
  }

  async findByEmailWithHash(email: string): Promise<UserWithHash | null> {
    const { rows } = await this.db.query<UserWithHash>(
      "SELECT id, email, created_at, password_hash FROM users WHERE email = $1",
      [email],
    );
    return rows[0] ?? null;
  }
}
