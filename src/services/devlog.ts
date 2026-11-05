/**
 * Playback diagnostics for development, written by the dev server to logs/playback.log.
 *
 * Off in production and in tests: the check on import.meta.env lets the bundler drop every call
 * site's work from the build, so a television never logs or posts anything.
 */

const ENABLED = import.meta.env.DEV && import.meta.env.MODE !== "test";
const ENDPOINT = "/__openiptv_dev_log__";

type Line = { t: string; event: string } & Record<string, unknown>;

let queue: Line[] = [];
let timer: number | undefined;

const flush = () => {
  timer = undefined;
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(batch),
    keepalive: true,
  }).catch(() => {});
};

export function devlog(event: string, data: Record<string, unknown> = {}) {
  if (!ENABLED) return;
  const line: Line = { t: new Date().toISOString(), event, ...data };
  queue.push(line);
  if (timer === undefined) timer = window.setTimeout(flush, 1000);
}

/**
 * An address reduced to what diagnosis needs: the host and the file name.
 *
 * Xtream addresses carry the username and password in the path, so the middle is left out. A
 * relayed address is unwrapped first so the log names the real provider.
 */
export function where(address: string | undefined): string {
  if (!address) return "";
  try {
    let url = new URL(address, window.location.href);
    let relayed = false;
    const inner = url.searchParams.get("url");
    if (url.pathname.endsWith("__openiptv_http_relay__") && inner) {
      url = new URL(inner);
      relayed = true;
    }
    const name = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
    return `${relayed ? "relay→" : ""}${url.protocol}//${url.host}/…/${name}`;
  } catch {
    return "?";
  }
}
