import { IsIn, IsOptional, IsString } from 'class-validator';

export class TenantAdminDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class CreateTenantDto {
  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsOptional()
  branding?: Record<string, unknown>;

  @IsOptional()
  settings?: {
    vocabulary?: Record<string, string>;
    seedOnCreate?: boolean;
  };

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  admin?: TenantAdminDto;
}
