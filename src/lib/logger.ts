import fs from "node:fs";
import path from "node:path";

type Level = "info" | "warn" | "error" | "debug";

const LOG_DIR = path.join(process.cwd(), "logs");

function writeLine(line: string) {
  // Always mirror to stdout so hosting platforms capture it.
  process.stdout.write(line + "\n");
  try {
    if (process.env.LOG_TO_FILE !== "0") {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      fs.appendFileSync(path.join(LOG_DIR, "app.log"), line + "\n", "utf8");
    }
  } catch {
    // file logging must never break the request
  }
}

function format(level: Level, msg: string, meta?: Record<string, unknown>) {
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  });
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    writeLine(format("info", msg, meta)),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    writeLine(format("warn", msg, meta)),
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production")
      writeLine(format("debug", msg, meta));
  },
  error: (msg: string, meta?: Record<string, unknown>) =>
    writeLine(format("error", msg, meta)),
};

/** Central error reporter: logs structured JSON + writes stack to error.log. */
export function logError(
  err: unknown,
  context?: Record<string, unknown>
): void {
  const e = err as Error;
  logger.error(e?.message || String(err), {
    ...context,
    stack: e?.stack?.split("\n").slice(0, 6).join(" | "),
  });
  try {
    if (process.env.LOG_TO_FILE !== "0") {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      fs.appendFileSync(
        path.join(LOG_DIR, "error.log"),
        `[${new Date().toISOString()}] ${e?.stack || String(err)}\n${
          JSON.stringify(context || {}) }\n\n`,
        "utf8"
      );
    }
  } catch {
    /* ignore */
  }
}
