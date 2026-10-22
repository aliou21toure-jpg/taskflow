import pg from "pg";

// Return DATE columns as "YYYY-MM-DD" strings instead of JS Dates
// (avoids timezone shifts when a due date is serialised to JSON).
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

/** The minimal database surface the app needs — easy to fake in unit tests. */
export interface Db {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<pg.QueryResult<R>>;
}

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
}
