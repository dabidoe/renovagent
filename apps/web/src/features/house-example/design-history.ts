// Session-only edit checkpoints. Generated images and canonical saved revisions
// are deliberately outside this history.
export type EditHistory<T> = { entries: { value: T; json: string; at: number }[]; index: number };
export function startEditHistory<T>(value: T): EditHistory<T> {
  return { entries: [{ value, json: JSON.stringify(value), at: 0 }], index: 0 };
}
export function recordEdit<T>(
  history: EditHistory<T>,
  value: T,
  at: number,
  separate = false,
): EditHistory<T> {
  const json = JSON.stringify(value);
  if (history.entries[history.index]?.json === json) return history;
  const entries = history.entries.slice(0, history.index + 1);
  // Group typing and continuous dragging, but preserve the initial checkpoint.
  if (
    !separate &&
    history.index > 0 &&
    history.index === history.entries.length - 1 &&
    at - entries.at(-1)!.at < 450
  )
    entries[entries.length - 1] = { value, json, at };
  else entries.push({ value, json, at });
  const bounded = entries.slice(-50);
  return { entries: bounded, index: bounded.length - 1 };
}
