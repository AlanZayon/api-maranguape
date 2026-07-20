import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type BrandingPolicy = {
  customCssEnabled: boolean;
  customCssMaxLength: number;
  editableFields: string[];
  allowedSelectors: string[];
  fontUrlHosts: string[];
  brandingAssetMaxBytes: number;
};

@Injectable()
export class BrandingPolicyService {
  constructor(private readonly config: ConfigService) {}

  getPolicy(): BrandingPolicy {
    return {
      customCssEnabled:
        String(this.config.get('TENANT_CUSTOM_CSS_ENABLED') ?? 'true') !==
        'false',
      customCssMaxLength: Number(
        this.config.get('TENANT_CUSTOM_CSS_MAX_LENGTH') ?? 20000,
      ),
      editableFields: String(
        this.config.get('TENANT_BRANDING_EDITABLE_FIELDS') ??
          'logoUrl,faviconUrl,displayName,primaryColor,secondaryColor,primaryContrast,headerBg,headerText,sidebarBg,sidebarText,surfaceBg,pageBg,textColor,mutedColor,borderColor,fontFamily,fontUrl,themeMode,customCss',
      )
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      allowedSelectors: String(
        this.config.get('TENANT_CUSTOM_CSS_ALLOWED_SELECTORS') ??
          '.login-page,.login-card,.sidebar,.app-header,.app-shell,.btn-brand,.dashboard-page,.dashboard-stat,.relatorio-preview,.relatorio-document',
      )
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      fontUrlHosts: String(
        this.config.get('TENANT_FONT_URL_HOSTS') ??
          'fonts.googleapis.com,fonts.gstatic.com',
      )
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      brandingAssetMaxBytes: Number(
        this.config.get('TENANT_BRANDING_ASSET_MAX_BYTES') ?? 2097152,
      ),
    };
  }
}
