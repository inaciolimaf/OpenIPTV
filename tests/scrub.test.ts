import { expect, test } from "vitest";
import { percentTarget, scrubStep, scrubTarget } from "../src/services/scrub";

test("presses in one run move further the longer the run goes on", () => {
  expect([0, 2, 3, 7, 8, 14, 15, 100].map(scrubStep)).toEqual([
    10, 10, 30, 30, 60, 60, 300, 300,
  ]);
});

test("the target stays inside the film", () => {
  expect(scrubTarget(5, -10, 7200)).toBe(0);
  expect(scrubTarget(7195, 10, 7200)).toBe(7200);
  expect(scrubTarget(7195, 10, null)).toBe(7205);
});

test("a digit is a tenth of the film, and 5 is the middle", () => {
  expect(percentTarget(0, 7200)).toBe(0);
  expect(percentTarget(5, 7200)).toBe(3600);
  expect(percentTarget(9, 7200)).toBe(6480);
});
