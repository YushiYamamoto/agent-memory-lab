export const DEFAULT_SEARCH_LIMIT = 5;

export function resolveSearchLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_SEARCH_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error(`Invalid limit: expected a positive integer >= 1, received ${formatReceived(limit)}`);
  }
  return limit;
}

export function parseSearchLimitOption(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(
      `Invalid limit: expected a positive integer >= 1, received ${JSON.stringify(value)}`,
    );
  }
  return resolveSearchLimit(Number(value));
}

function formatReceived(limit: number): string {
  if (Number.isNaN(limit)) return "NaN";
  return String(limit);
}
