import { describe, expect, test } from "vitest";
import { createTokenisedLiveLoaders, stabilise } from "../src/services/tokenisedLive";

const playlist = (sequence: number, token: string) =>
  [
    "#EXTM3U",
    "#EXT-X-TARGETDURATION:10",
    `#EXT-X-MEDIA-SEQUENCE:${sequence}`,
    "#EXTINF:10.0,",
    `/hls/${token}-a`,
    "#EXTINF:10.0,",
    `/hls/${token}-b`,
    "",
  ].join("\n");

test("segments get names that stay the same when the token changes", () => {
  const first = stabilise(playlist(144, "t1"), "http://cdn.example/x/index");
  const second = stabilise(playlist(145, "t2"), "http://cdn.example/x/index");
  expect(first?.text).toContain("__openiptv-seg-145.ts");
  expect(second?.text).toContain("__openiptv-seg-145.ts");
  expect(first?.text).not.toContain("/hls/");
});

test("each stable name maps to the newest real address, resolved against the playlist", () => {
  const second = stabilise(playlist(145, "t2"), "http://cdn.example/x/index");
  expect(second?.addresses.get(145)).toBe("http://cdn.example/hls/t2-a");
  expect(second?.addresses.get(146)).toBe("http://cdn.example/hls/t2-b");
});

test("master playlists, finished playlists and unnumbered ones are left alone", () => {
  expect(stabilise("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nv.m3u8\n", "http://a/")).toBeNull();
  expect(stabilise(`${playlist(1, "t")}#EXT-X-ENDLIST\n`, "http://a/")).toBeNull();
  expect(stabilise("#EXTM3U\n#EXTINF:10,\na.ts\n", "http://a/")).toBeNull();
});

describe("the loaders hls.js is given", () => {
  const ORIGINAL = "https://panel.example/live/u/p/100.m3u8";
  const requested: string[] = [];
  let issued = 0;
  class FakeBase {
    stats = {};
    load(
      context: { url: string },
      _config: unknown,
      callbacks: { onSuccess: (...args: unknown[]) => void },
    ) {
      requested.push(context.url);
      if (context.url !== ORIGINAL) {
        callbacks.onSuccess({ url: context.url, data: "segment" }, {}, context, null);
        return;
      }
      issued += 1;
      const token = `http://cdn.example/t${issued}/index`;
      const sequence = 144 + issued;
      const text = `#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:${sequence}\n#EXTINF:10,\n/hls/t${issued}-${sequence}\n`;
      callbacks.onSuccess({ url: token, data: text }, {}, context, null);
    }
    abort() {}
    destroy() {}
  }
  const Hls = { DefaultConfig: { loader: FakeBase } } as never;
  type Loaded = { url: string; data: string };
  const load = (Loader: unknown, url: string) =>
    new Promise<Loaded>((resolve) => {
      const loader = new (
        Loader as new (
          c: unknown,
        ) => {
          load: (c: unknown, k: unknown, b: unknown) => void;
        }
      )({});
      loader.load({ url }, {}, { onSuccess: (response: Loaded) => resolve(response) });
    });

  test("every reload goes to the original, however old the address hls.js asks for", async () => {
    requested.length = 0;
    issued = 0;
    const { pLoader, fLoader } = createTokenisedLiveLoaders(Hls, ORIGINAL);
    const first = await load(pLoader, ORIGINAL);
    expect(first.data).toContain("__openiptv-seg-145.ts");
    await load(pLoader, "http://cdn.example/t1/index");
    await load(pLoader, "http://cdn.example/t1/index");
    expect(requested).toEqual([ORIGINAL, ORIGINAL, ORIGINAL]);

    await load(fLoader, "http://cdn.example/t1/__openiptv-seg-147.ts");
    expect(requested.at(-1)).toBe("http://cdn.example/hls/t3-147");
  });
});
