/**
 * Randomise participant order, placing anyone whose name matches
 * `lastPattern` (case-insensitive substring) at the end.
 *
 * Pure function — unit testable with no DOM or browser dependencies.
 */
export function orderParticipants(names: string[], lastPattern: string): string[] {
  const lower = lastPattern.toLowerCase();
  const last: string[] = [];
  const rest: string[] = [];

  for (const name of names) {
    if (name.toLowerCase().includes(lower)) {
      last.push(name);
    } else {
      rest.push(name);
    }
  }

  shuffle(rest);
  shuffle(last);

  return [...rest, ...last];
}

/** Fisher-Yates in-place shuffle. */
function shuffle(arr: string[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
