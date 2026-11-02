import type { ActionErrorKey } from "./action-state";

type DbError = { code?: string; message?: string } | null | undefined;

/** Map Postgres / PostgREST error codes to user-facing message keys. */
export function dbErrorKey(error: DbError): ActionErrorKey {
  switch (error?.code) {
    case "42501":
      return "notAllowed";
    case "23505":
      return "duplicate";
    case "23514":
      return error.message?.startsWith("too many rows") ? "limitReached" : "invalid";
    case "22023":
    case "22P02":
    case "22001":
    case "23502":
    case "23503":
      return "invalid";
    case "55000":
      return "wrongState";
    case "54000":
      return "limitReached";
    case "PGRST116":
      return "notFound";
    default:
      return "generic";
  }
}
