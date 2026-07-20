import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Tenant } from './schemas/tenant.schema';
import { User } from '../auth/schemas/user.schema';
import { Setor } from '../setores/schemas/setor.schema';
import { LimiteSimbologia } from '../funcionarios/schemas/limite-simbologia.schema';
import { SIMBOLOGIA_MODEL } from '../../database/database.module';
import { AppError } from '../../common/errors/app-error';
import { S3Service } from '../../infrastructure/s3/s3.service';
import { BrandingPolicyService } from '../../config/branding-policy.service';
import { isReservedSubdomain } from '../../common/utils/tenant.helpers';
import {
  sanitizeColor,
  sanitizeFontUrl,
  sanitizeCustomCss,
  mergeBranding,
  filterEditableBranding,
  stripCustomCssIfDisabled,
} from './branding.utils';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

const DEFAULT_VOCABULARY: Record<string, string> = {
  funcionario: 'Funcionário',
  setor: 'Setor',
  subsetor: 'Subsetor',
  cargo: 'Cargo',
  referencia: 'Referência',
};

@Injectable()
export class TenantsService {
  constructor(
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Setor.name) private readonly setorModel: Model<Setor>,
    @InjectModel(SIMBOLOGIA_MODEL)
    private readonly simbologiaModel: Model<LimiteSimbologia>,
    private readonly s3Service: S3Service,
    private readonly brandingPolicyService: BrandingPolicyService,
  ) {}

  private async resolveMediaUrl(value: unknown): Promise<string | null> {
    if (!value) return null;
    const raw = String(value);
    if (/^https?:\/\//i.test(raw)) return raw;
    try {
      return await this.s3Service.gerarUrlPreAssinada(raw);
    } catch {
      return raw;
    }
  }

  private async brandingPayload(tenant: Record<string, unknown>) {
    const policy = this.brandingPolicyService.getPolicy();
    let branding: Record<string, unknown> = {
      ...((tenant.branding as Record<string, unknown>) || {}),
    };
    branding.logoUrl = await this.resolveMediaUrl(branding.logoUrl);
    branding.faviconUrl = await this.resolveMediaUrl(branding.faviconUrl);
    branding = stripCustomCssIfDisabled(branding, policy) || {};

    return {
      slug: tenant.slug,
      name: tenant.name,
      branding,
      settings: tenant.settings,
      status: tenant.status,
      _id: tenant._id,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  private normalizeBranding(
    branding: Record<string, unknown> = {},
    name?: string,
    { filterEditable = true }: { filterEditable?: boolean } = {},
  ): Record<string, unknown> {
    const policy = this.brandingPolicyService.getPolicy();
    const source: Record<string, unknown> = filterEditable
      ? { ...filterEditableBranding(branding, policy) }
      : { ...(branding || {}) };

    const pick = (key: string, fallback: unknown = null) => {
      if (source[key] !== undefined) return source[key];
      if (!filterEditable && branding[key] !== undefined) return branding[key];
      return fallback;
    };

    return {
      logoUrl: pick('logoUrl', null) || null,
      faviconUrl: pick('faviconUrl', null) || null,
      primaryColor: sanitizeColor(pick('primaryColor'), '#1a5f2a'),
      secondaryColor: (() => {
        const raw = pick('secondaryColor', null);
        if (raw == null || raw === '') return null;
        return sanitizeColor(raw, null);
      })(),
      primaryContrast: sanitizeColor(pick('primaryContrast'), '#ffffff'),
      headerBg: sanitizeColor(pick('headerBg'), '#1b1f24'),
      headerText: sanitizeColor(pick('headerText'), '#f8f9fa'),
      sidebarBg: sanitizeColor(pick('sidebarBg'), '#ffffff'),
      sidebarText: sanitizeColor(pick('sidebarText'), '#343a40'),
      surfaceBg: sanitizeColor(pick('surfaceBg'), '#ffffff'),
      pageBg: sanitizeColor(pick('pageBg'), '#f3f4f6'),
      textColor: sanitizeColor(pick('textColor'), '#212529'),
      mutedColor: sanitizeColor(pick('mutedColor'), '#6c757d'),
      borderColor: sanitizeColor(pick('borderColor'), '#dee2e6'),
      fontFamily: pick('fontFamily', null) || null,
      fontUrl: sanitizeFontUrl(pick('fontUrl', null), policy),
      themeMode: pick('themeMode') === 'dark' ? 'dark' : 'light',
      customCss: (() => {
        if (!policy.customCssEnabled) {
          return filterEditable ? null : (branding.customCss ?? null);
        }
        return sanitizeCustomCss(pick('customCss', null), policy);
      })(),
      displayName: pick('displayName', null) || name,
    };
  }

  async getById(id: string) {
    const tenant = await this.tenantModel.findById(id).lean();
    if (!tenant) {
      throw new AppError('Tenant não encontrado', 404, 'TENANT_NOT_FOUND');
    }
    return this.brandingPayload(tenant);
  }

  async getBySlug(slug: string) {
    const tenant = await this.tenantModel
      .findOne({
        slug: String(slug).toLowerCase().trim(),
        status: 'active',
      })
      .lean();

    if (!tenant) {
      throw new AppError('Tenant não encontrado', 404, 'TENANT_NOT_FOUND');
    }

    const payload = await this.brandingPayload(tenant);
    return {
      slug: payload.slug,
      name: payload.name,
      branding: payload.branding,
      settings: {
        vocabulary:
          (
            tenant.settings as unknown as {
              vocabulary?: Record<string, string>;
            }
          )?.vocabulary || {},
      },
    };
  }

  async list() {
    const tenants = await this.tenantModel.find().sort({ name: 1 }).lean();
    return Promise.all(tenants.map((t) => this.brandingPayload(t)));
  }

  async seedDefaults(
    tenantId: Types.ObjectId | string,
    userId: unknown = null,
  ) {
    const existingRoot = await this.setorModel.findOne({
      tenantId,
      parent: null,
    });
    if (!existingRoot) {
      await this.setorModel.create({
        nome: 'ADMINISTRAÇÃO',
        tipo: 'Setor',
        parent: null,
        tenantId,
        createdBy: userId,
      });
    }

    const defaultSimb = await this.simbologiaModel.findOne({
      tenantId,
      simbologia: 'DAS-1',
    });
    if (!defaultSimb) {
      await this.simbologiaModel.create({
        simbologia: 'DAS-1',
        limite: 10,
        tenantId,
        createdBy: userId,
      });
    }
  }

  async create(data: CreateTenantDto) {
    const {
      slug,
      name,
      branding = {},
      settings = {},
      status = 'active',
      admin,
    } = data;

    if (!slug || !name) {
      throw new AppError('slug e name são obrigatórios', 400, 'VALIDATION_ERROR');
    }

    const normalizedSlug = String(slug).toLowerCase().trim();
    if (isReservedSubdomain(normalizedSlug)) {
      throw new AppError('Slug reservado pela plataforma', 400, 'RESERVED_SLUG');
    }

    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(normalizedSlug)) {
      throw new AppError(
        'Slug inválido (use letras minúsculas, números e hífens)',
        400,
        'INVALID_SLUG',
      );
    }

    const seedOnCreate =
      settings.seedOnCreate === undefined ? true : Boolean(settings.seedOnCreate);

    let tenant: (Tenant & { _id: Types.ObjectId; toObject: () => Record<string, unknown> }) | undefined;
    try {
      tenant = (await this.tenantModel.create({
        slug: normalizedSlug,
        name,
        branding: this.normalizeBranding(branding, name),
        settings: {
          vocabulary: {
            ...DEFAULT_VOCABULARY,
            ...(settings.vocabulary || {}),
          },
          seedOnCreate,
        },
        status,
      })) as unknown as Tenant & {
        _id: Types.ObjectId;
        toObject: () => Record<string, unknown>;
      };
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new AppError('Slug de tenant já existe', 409, 'CONFLICT');
      }
      throw err;
    }

    let firstAdmin: Record<string, unknown> | null = null;
    if (admin?.username && admin?.password) {
      const passwordHash = await bcrypt.hash(admin.password, 10);
      const createdAdmin = await this.userModel.create({
        id: admin.id || randomUUID(),
        username: admin.username,
        passwordHash,
        role: 'owner',
        tenantId: tenant._id,
      });
      const obj = (
        createdAdmin as unknown as { toObject: () => Record<string, unknown> }
      ).toObject();
      delete obj.passwordHash;
      delete obj.lastValidToken;
      firstAdmin = obj;
    }

    if (seedOnCreate) {
      await this.seedDefaults(tenant._id, firstAdmin?._id || null);
    }

    return {
      tenant: await this.brandingPayload(tenant.toObject()),
      admin: firstAdmin,
    };
  }

  async update(id: string, data: UpdateTenantDto) {
    const tenant = await this.tenantModel.findById(id);
    if (!tenant) {
      throw new AppError('Tenant não encontrado', 404, 'TENANT_NOT_FOUND');
    }

    if (data.name !== undefined) tenant.name = data.name;
    if (data.status !== undefined) {
      if (!['active', 'inactive'].includes(data.status)) {
        throw new AppError('Status inválido', 400, 'VALIDATION_ERROR');
      }
      tenant.status = data.status;
    }
    if (data.branding) {
      const brandingDoc = tenant.branding as unknown as {
        toObject?: () => Record<string, unknown>;
      };
      const existing = brandingDoc?.toObject?.() || tenant.branding || {};
      const policy = this.brandingPolicyService.getPolicy();
      const merged = mergeBranding(
        existing as Record<string, unknown>,
        data.branding,
        policy,
      );
      tenant.branding = this.normalizeBranding(
        merged,
        data.name || tenant.name,
        { filterEditable: false },
      ) as never;
    }
    if (data.settings) {
      tenant.settings = {
        vocabulary: {
          ...(tenant.settings?.vocabulary || {}),
          ...(data.settings.vocabulary || {}),
        },
        seedOnCreate:
          data.settings.seedOnCreate !== undefined
            ? Boolean(data.settings.seedOnCreate)
            : tenant.settings?.seedOnCreate,
      };
    }

    await tenant.save();
    return this.brandingPayload(
      (tenant as unknown as { toObject: () => Record<string, unknown> }).toObject(),
    );
  }

  async updateMe(tenantId: string, data: UpdateTenantDto) {
    const allowed: UpdateTenantDto = {
      branding: data.branding,
      settings: data.settings
        ? { vocabulary: data.settings.vocabulary }
        : undefined,
    };
    return this.update(tenantId, allowed);
  }

  async deactivate(id: string) {
    return this.update(id, { status: 'inactive' });
  }

  async uploadAsset(
    tenantId: string,
    file: Express.Multer.File | undefined,
    kind: string = 'logo',
  ) {
    if (!file) {
      throw new AppError('Arquivo obrigatório', 400, 'VALIDATION_ERROR');
    }
    if (!['logo', 'favicon'].includes(kind)) {
      throw new AppError('kind deve ser logo ou favicon', 400, 'VALIDATION_ERROR');
    }

    const policy = this.brandingPolicyService.getPolicy();
    if (file.size > policy.brandingAssetMaxBytes) {
      throw new AppError(
        `Arquivo excede o limite de ${policy.brandingAssetMaxBytes} bytes`,
        400,
        'FILE_TOO_LARGE',
      );
    }

    const mime = String(file.mimetype || '');
    if (!mime.startsWith('image/')) {
      throw new AppError('Arquivo deve ser uma imagem', 400, 'INVALID_FILE_TYPE');
    }

    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new AppError('Tenant não encontrado', 404, 'TENANT_NOT_FOUND');
    }

    const key = await this.s3Service.uploadFile(
      file,
      `branding/${kind}`,
      tenantId,
    );
    const url = await this.s3Service.gerarUrlPreAssinada(key);

    if (kind === 'logo') {
      tenant.branding.logoUrl = key;
    } else {
      tenant.branding.faviconUrl = key;
    }
    await tenant.save();

    return {
      kind,
      key,
      url,
      tenant: await this.brandingPayload(
        (tenant as unknown as { toObject: () => Record<string, unknown> }).toObject(),
      ),
    };
  }
}
