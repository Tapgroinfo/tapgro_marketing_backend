export enum Sort {
  ASC = 'ASC',
  DESC = 'DESC',
}

export type Pagination = {
  limit?: number;
  page?: number;
  search?: string;
  sort_attr?: string;
  sort?: Sort;
};
