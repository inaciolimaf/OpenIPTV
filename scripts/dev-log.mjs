import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const DEV_LOG_PATH = "/__openiptv_dev_log__";

/**
 * Development only: the playback log the browser sends, written to logs/playback.log.
 *
 * A stall on a laptop happens in somebody's own browser, where nothing outside it can read the
 * console. Writing the events to a file next to the checkout makes them readable afterwards.
 * The production build never includes the sender, so a television never posts anything.
 */
export function devLog() {
  const directory = join(process.cwd(), "logs");
  const file = join(directory, "playback.log");
  return {
    name: "openiptv-dev-log",
    apply: "serve",
    configureServer(server) {
      mkdirSync(directory, { recursive: true });
      server.middlewares.use(DEV_LOG_PATH, (request, response) => {
        if (request.method !== "POST") {
          response.writeHead(405).end();
          return;
        }
        let body = "";
        request.on("data", (chunk) => {
          body += chunk;
          if (body.length > 1024 * 1024) request.destroy();
        });
        request.on("end", () => {
          try {
            const lines = JSON.parse(body);
            if (Array.isArray(lines) && lines.length) {
              appendFileSync(file, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);
            }
          } catch {
            /* a malformed batch is dropped, not fatal */
          }
          response.writeHead(204).end();
        });
      });
    },
  };
}
