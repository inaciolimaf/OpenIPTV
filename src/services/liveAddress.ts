/**
 * Whether an address is shaped like an Xtream live channel: /live/<user>/<password>/<id>, or the
 * same without /live. Panels serving these commonly redirect to a tokenised address that dies
 * within seconds, which the television's own player cannot follow; see services/tokenisedLive.
 */
export function mightRedirect(original: string): boolean {
  try {
    const url = new URL(original);
    if (/^(localhost|127\.|\[::1\])/.test(url.host)) return false;
    return /^\/(live\/)?[^/]+\/[^/]+\/\d+(\.\w+)?$/.test(url.pathname);
  } catch {
    return false;
  }
}
