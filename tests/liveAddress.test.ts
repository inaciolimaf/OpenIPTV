import { expect, test, vi } from "vitest";
import {
  forgetResolved,
  refreshResolved,
  rememberResolved,
  resolvedFor,
} from "../src/services/liveAddress";

test("only a real redirect is remembered, and it can be forgotten", () => {
  rememberResolved("https://a.invalid/1", "https://a.invalid/1");
  expect(resolvedFor("https://a.invalid/1")).toBeUndefined();
  rememberResolved("https://a.invalid/1", "https://b.invalid/t");
  expect(resolvedFor("https://a.invalid/1")).toBe("https://b.invalid/t");
  forgetResolved("https://a.invalid/1");
  expect(resolvedFor("https://a.invalid/1")).toBeUndefined();
});

test("a refresh remembers the new address, and a failure changes nothing", async () => {
  const ok = vi.fn(async () => ({ ok: true, url: "https://b.invalid/new" }) as Response);
  expect(await refreshResolved("https://a.invalid/2", ok)).toBe("https://b.invalid/new");
  expect(resolvedFor("https://a.invalid/2")).toBe("https://b.invalid/new");

  const down = vi.fn(async () => {
    throw new Error("offline");
  });
  expect(await refreshResolved("https://a.invalid/2", down)).toBeUndefined();
  expect(resolvedFor("https://a.invalid/2")).toBe("https://b.invalid/new");
});
