import { ApiQuery } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';

export function PaginationDecorator() {
  return applyDecorators(
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
    }),
    ApiQuery({
      name: 'search',
      required: false,
      type: String,
    }),
    ApiQuery({
      name: 'sort_attr',
      required: false,
      type: String,
    }),
    ApiQuery({
      name: 'sort',
      required: false,
      type: String,
    }),
  );
}
