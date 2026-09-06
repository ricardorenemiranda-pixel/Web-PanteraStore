/**
 * Corre `fn` sobre `items` con como máximo `limit` llamadas en vuelo a la
 * vez, en vez de todas en paralelo (Promise.all) o una por una (secuencial).
 * Se usa acá para no reventar el rate limit de Steam Market cuando hay que
 * pedir el precio de decenas de items de una — ver GetSellableInventoryUseCase.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
