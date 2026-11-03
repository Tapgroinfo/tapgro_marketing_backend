export interface PaginationResult<T> {
  pagination: {
    total: number;
    perPage: number;
    currentPageTotal: number;
    currentPage: number;
    totalPages: number;
  };

  data: T[];
}
