export type MaybeJoined<T> = T | T[] | null;

export function takeJoined<T>(value: MaybeJoined<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}
