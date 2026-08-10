export interface PaginateMeta {
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

export interface PaginateResult<T> {
  data: T[];
  meta: PaginateMeta;
}

export function buildPaginateMeta(
  total: number,
  page: number,
  limit: number,
): PaginateMeta {
  return { total, page, limit, hasNext: page * limit < total };
}

export function paginateResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginateResult<T> {
  return { data, meta: buildPaginateMeta(total, page, limit) };
}
