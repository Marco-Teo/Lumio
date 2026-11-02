export function batchPositions(
  count: number,
  maximum: number,
  occupied: number[],
) {
  const free = Array.from({ length: maximum }, (_, index) => index + 1).filter(
    (position) => !occupied.includes(position),
  );
  if (count > free.length)
    throw new Error(
      `Puoi aggiungere ancora ${free.length} ${free.length === 1 ? 'fotografia' : 'fotografie'} a questa opera. Seleziona al massimo ${free.length} file.`,
    );
  return free.slice(0, count);
}
