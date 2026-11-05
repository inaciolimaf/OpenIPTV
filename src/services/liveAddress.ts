/**
 * The temporary addresses live channels redirect to, remembered so a reconnection can skip the
 * slow first request.
 *
 * Xtream panels commonly answer a channel's address with a redirect to a tokenised address on
 * another host, and generating that token is the slow part: twenty seconds, measured, against a
 * quarter of a second for every reload after it. A reconnection that goes back to the panel pays
 * those twenty seconds again behind a frozen picture. So the address the redirect landed on is
 * kept, a reconnection goes straight to it, and a fresh one is asked for at the same time in case
 * the token has expired.
 */

const LIMIT = 50;
const resolved = new Map<string, string>();

export function rememberResolved(original: string, final: string | undefined) {
  if (!final || final === original) return;
  resolved.delete(original);
  resolved.set(original, final);
  if (resolved.size > LIMIT) {
    const oldest = resolved.keys().next().value;
    if (oldest !== undefined) resolved.delete(oldest);
  }
}

export function resolvedFor(original: string): string | undefined {
  return resolved.get(original);
}

export function forgetResolved(original: string) {
  resolved.delete(original);
}

/**
 * Ask the panel for a fresh temporary address, in the background. Resolves to it, or to
 * undefined when the panel did not redirect or could not be reached.
 */
export async function refreshResolved(
  original: string,
  fetcher: typeof fetch = fetch,
): Promise<string | undefined> {
  try {
    const response = await fetcher(original, { cache: "no-store" });
    void response.body?.cancel().catch(() => {});
    if (!response.ok || !response.url || response.url === original) return undefined;
    rememberResolved(original, response.url);
    return response.url;
  } catch {
    return undefined;
  }
}

/** Hosts seen answering directly, so their channels are not resolved again on every zap. */
const direct = new Set<string>();

const RESOLVE_TIMEOUT_MS = 25000;

const hostOf = (address: string): string => {
  try {
    return new URL(address).host;
  } catch {
    return "";
  }
};

/**
 * Follow a live channel's redirect before handing it to the television's own player.
 *
 * AVPlay follows redirects silently and never says where it landed, so on the television the
 * temporary address can only be learnt by asking first. The question is the same request AVPlay
 * would have made, and the body is abandoned as soon as the headers arrive, so a panel that
 * redirects is asked once rather than twice. A host that answers directly is remembered and
 * skipped from then on, so zapping between its channels costs nothing extra.
 *
 * Resolves to the temporary address, or undefined when there is nothing to gain: no redirect, a
 * local address (the compatibility repair serves from loopback), or no answer.
 */
/**
 * Whether resolving first could help: an Xtream live address, on a host not already known to
 * answer directly. Anything else opens at once, as it always did, so zapping pays nothing.
 */
export function mightRedirect(original: string): boolean {
  try {
    const url = new URL(original);
    if (direct.has(url.host) || /^(localhost|127\.|\[::1\])/.test(url.host)) return false;
    return /^\/(live\/)?[^/]+\/[^/]+\/\d+(\.\w+)?$/.test(url.pathname);
  } catch {
    return false;
  }
}

export async function resolveRedirect(
  original: string,
  fetcher: typeof fetch = fetch,
): Promise<string | undefined> {
  if (!mightRedirect(original)) return undefined;
  const host = hostOf(original);
  const controller = typeof AbortController === "undefined" ? undefined : new AbortController();
  const timer = setTimeout(() => controller?.abort(), RESOLVE_TIMEOUT_MS);
  try {
    const response = await fetcher(original, { cache: "no-store", signal: controller?.signal });
    void response.body?.cancel().catch(() => {});
    if (!response.ok || !response.url) return undefined;
    if (response.url === original) {
      direct.add(host);
      return undefined;
    }
    rememberResolved(original, response.url);
    return response.url;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
