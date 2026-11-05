/**
 * Moving through a film or an episode with left and right.
 *
 * Each press moves a pending target rather than the picture, and the seek waits until the
 * pressing stops, so holding the key to cross an hour costs one seek instead of hundreds. Presses
 * in the same direction inside one run move further each time, which is what makes the middle of
 * a two hour film a few seconds of holding a key rather than a few hundred presses.
 */

/** How long after the last press the pending target is sent to the player. */
export const SCRUB_SETTLE_MS = 600;

/** Seconds one press moves, by how many presses in the same direction came before it. */
export function scrubStep(presses: number): number {
  if (presses < 3) return 10;
  if (presses < 8) return 30;
  if (presses < 15) return 60;
  return 300;
}

/** The pending target after moving by `seconds`, kept inside the film. */
export function scrubTarget(from: number, seconds: number, duration: number | null): number {
  const moved = Math.max(0, from + seconds);
  return duration ? Math.min(duration, moved) : moved;
}

/** Where a digit lands: 0 is the start, 5 the middle, 9 the last tenth. */
export function percentTarget(digit: number, duration: number): number {
  return (duration * Math.max(0, Math.min(9, digit))) / 10;
}
