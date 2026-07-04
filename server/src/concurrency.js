/** Run worker(item, index) over items with at most `limit` in flight at once. */
export async function runWithConcurrency(items, limit, worker) {
  let cursor = 0;
  async function lane() {
    while (cursor < items.length) {
      const i = cursor++;
      await worker(items[i], i);
    }
  }
  const lanes = Array.from({ length: Math.min(limit, items.length) }, () => lane());
  await Promise.all(lanes);
}
