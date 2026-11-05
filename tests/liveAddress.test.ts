import { expect, test } from "vitest";
import { mightRedirect } from "../src/services/liveAddress";

test("only an Xtream live address is taken for one that may redirect", () => {
  expect(mightRedirect("https://panel.example/live/user/pass/100.m3u8")).toBe(true);
  expect(mightRedirect("http://panel.example/user/pass/100")).toBe(true);
  expect(mightRedirect("http://example.invalid/a.m3u8")).toBe(false);
  expect(mightRedirect("http://127.0.0.1:8080/live/u/p/1.m3u8")).toBe(false);
  expect(mightRedirect("not an address")).toBe(false);
});
