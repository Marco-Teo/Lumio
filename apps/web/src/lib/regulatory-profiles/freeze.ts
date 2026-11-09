/** Plain catalog data only: arrays and nested records, without Map/Set or classes. */
export function freezeRecursively<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value) as unknown[])
      freezeRecursively(child);
    Object.freeze(value);
  }
  return value;
}
