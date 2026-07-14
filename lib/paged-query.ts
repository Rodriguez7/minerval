type PageResult<T> = {
  data: T[] | null;
  error?: { message?: string } | null;
};

export async function collectAllPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1_000
) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const result = await loadPage(from, from + pageSize - 1);
    if (result.error) {
      throw new Error(result.error.message ?? "Failed to load paginated data");
    }

    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
    from += pageSize;
  }
}
