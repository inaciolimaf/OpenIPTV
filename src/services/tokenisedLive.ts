import type HlsType from "hls.js";
import type {
  FragmentLoaderContext,
  HlsConfig,
  Loader,
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
  LoaderStats,
  PlaylistLoaderContext,
} from "hls.js";

/**
 * Live playlists behind a short lived redirect, played by hls.js.
 *
 * Measured on an Xtream panel: the channel's address redirects to a tokenised address on another
 * host, that address stops answering about ten seconds after it was issued, and every request to
 * the original issues a new one, carrying new segment addresses as well. Two things break:
 *
 *   hls.js reloads the address it landed on, which is dead by the second reload, so the picture
 *     plays out its buffer and stops. Fixed by reloading the original every time.
 *   each reload then lists the same segments under new addresses, and hls.js refuses a playlist
 *     whose segment N changed address ("media sequence mismatch"). Fixed by giving each segment a
 *     stable name built from its sequence number, and translating that name back to the newest
 *     real address only when the segment is fetched.
 *
 * Nothing changes for a playlist that was not redirected to another host, which is every source
 * that does not do this.
 */

/** A stable name for segment `sequence`, resolved against the playlist address by hls.js. */
const stableName = (sequence: number) => `__openiptv-seg-${sequence}.ts`;
const STABLE = /__openiptv-seg-(\d+)\.ts(?:$|\?)/;
/** How many sequence numbers behind the newest to keep addresses for. */
const KEEP = 60;

function redirected(requested: string, served: string): boolean {
  try {
    return new URL(requested).host !== new URL(served).host;
  } catch {
    return false;
  }
}

/** The playlist with each segment renamed, and the real addresses it named, by sequence. */
export function stabilise(
  text: string,
  base: string,
): { text: string; addresses: Map<number, string> } | null {
  const declared = /#EXT-X-MEDIA-SEQUENCE:\s*(\d+)/.exec(text);
  if (!declared || /#EXT-X-STREAM-INF/.test(text) || /#EXT-X-ENDLIST/.test(text)) return null;
  let sequence = Number(declared[1]);
  const addresses = new Map<number, string>();
  const lines = text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    try {
      addresses.set(sequence, new URL(trimmed, base).href);
    } catch {
      return line;
    }
    const name = stableName(sequence);
    sequence += 1;
    return name;
  });
  return addresses.size ? { text: lines.join("\n"), addresses } : null;
}

type AnyLoader<T extends LoaderContext> = Loader<T>;

export function createTokenisedLiveLoaders(
  Hls: typeof HlsType,
  original: string,
): Pick<HlsConfig, "pLoader" | "fLoader"> {
  const BaseLoader = Hls.DefaultConfig.loader;
  const real = new Map<number, string>();
  /**
   * Set once the original is seen redirecting to a short lived address. From then on every
   * playlist request is for the original: hls.js keeps asking for the first address it landed on,
   * which is long dead by the second reload, so recognising only the latest would not do.
   */
  let active = false;

  class PlaylistLoader implements AnyLoader<PlaylistLoaderContext> {
    private readonly base: AnyLoader<PlaylistLoaderContext>;
    context: PlaylistLoaderContext | null = null;
    stats: LoaderStats;

    constructor(config: HlsConfig) {
      this.base = new BaseLoader(config) as unknown as AnyLoader<PlaylistLoaderContext>;
      this.stats = this.base.stats;
    }

    load(
      context: PlaylistLoaderContext,
      config: LoaderConfiguration,
      callbacks: LoaderCallbacks<PlaylistLoaderContext>,
    ): void {
      if (active) context.url = original;
      this.context = context;
      this.base.load(context, config, {
        ...callbacks,
        onSuccess: (response, stats, loadedContext, networkDetails) => {
          const text = typeof response.data === "string" ? response.data : null;
          const served = response.url || loadedContext.url;
          const stable =
            text && (active || loadedContext.url === original) && redirected(original, served)
              ? stabilise(text, served)
              : null;
          if (!stable) {
            callbacks.onSuccess(response, stats, loadedContext, networkDetails);
            return;
          }
          active = true;
          let newest = 0;
          for (const [sequence, address] of stable.addresses) {
            real.set(sequence, address);
            newest = Math.max(newest, sequence);
          }
          for (const sequence of real.keys())
            if (sequence < newest - KEEP) real.delete(sequence);
          callbacks.onSuccess(
            { ...response, data: stable.text },
            stats,
            loadedContext,
            networkDetails,
          );
        },
      });
      this.stats = this.base.stats;
    }

    abort(): void {
      this.base.abort();
    }

    destroy(): void {
      this.context = null;
      this.base.destroy();
    }

    getCacheAge(): number | null {
      return this.base.getCacheAge?.() ?? null;
    }

    getResponseHeader(name: string): string | null {
      return this.base.getResponseHeader?.(name) ?? null;
    }
  }

  class FragmentLoader implements AnyLoader<FragmentLoaderContext> {
    private readonly base: AnyLoader<FragmentLoaderContext>;
    context: FragmentLoaderContext | null = null;
    stats: LoaderStats;

    constructor(config: HlsConfig) {
      this.base = new BaseLoader(config) as unknown as AnyLoader<FragmentLoaderContext>;
      this.stats = this.base.stats;
    }

    load(
      context: FragmentLoaderContext,
      config: LoaderConfiguration,
      callbacks: LoaderCallbacks<FragmentLoaderContext>,
    ): void {
      const match = STABLE.exec(context.url);
      const address = match ? real.get(Number(match[1])) : undefined;
      if (address) context.url = address;
      this.context = context;
      this.base.load(context, config, callbacks);
      this.stats = this.base.stats;
    }

    abort(): void {
      this.base.abort();
    }

    destroy(): void {
      this.context = null;
      this.base.destroy();
    }

    getCacheAge(): number | null {
      return this.base.getCacheAge?.() ?? null;
    }

    getResponseHeader(name: string): string | null {
      return this.base.getResponseHeader?.(name) ?? null;
    }
  }

  return {
    pLoader: PlaylistLoader as unknown as HlsConfig["pLoader"],
    fLoader: FragmentLoader as unknown as HlsConfig["fLoader"],
  };
}
