import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { SearchService } from './search.service';

/**
 * Ported from legacy/routes/searchRoutes.js + searchController.js.
 */
@Controller('api/search')
@UseGuards(AuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('autocomplete')
  async autocomplete(
    @Query('q') q: string | undefined,
    @TenantId() tenantId: string | null,
  ) {
    return this.searchService.autocomplete(q, tenantId);
  }

  @Get('search-funcionarios')
  async searchFuncionarios(
    @Query('q') q: string | undefined,
    @TenantId() tenantId: string | null,
  ) {
    return this.searchService.searchFuncionarios(q, tenantId);
  }
}
