import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  branding?: Record<string, unknown>;

  @IsOptional()
  settings?: {
    vocabulary?: Record<string, string>;
    seedOnCreate?: boolean;
  };
}
