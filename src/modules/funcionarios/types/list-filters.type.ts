export type ListFilters = {
  q?: string;
  natureza?: string;
  secretaria?: string;
  funcao?: string;
  bairro?: string;
  referencia?: string;
};

export type PaginatedResult<T> = {
  funcionarios: T[];
  total: number;
  page: number;
  pages: number;
};
