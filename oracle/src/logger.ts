/**
 * Minimal structured logger (JSON lines to stderr).
 * We use this instead of raw console.log in production code.
 */
type Level = "debug" | "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: Level = (process.env.LOG_LEVEL as Level) ?? "info";

function emit(level: Level, msg: string, fields?: LogFields): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const record = { level, msg, ...fields };
  process.stderr.write(`${JSON.stringify(record)}\n`);
}

export const logger = {
  debug: (msg: string, fields?: LogFields): void => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields): void => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields): void => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields): void => emit("error", msg, fields),
};

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
