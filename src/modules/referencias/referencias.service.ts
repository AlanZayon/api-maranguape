import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReferenciasRepository } from './referencias.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { Funcionario } from '../funcionarios/schemas/funcionario.schema';
import { tenantFilter, toObjectId } from '../../common/utils/tenant.helpers';
import { RegisterReferenceDto } from './dto/register-reference.dto';

@Injectable()
export class ReferenciasService {
  constructor(
    private readonly referenciasRepository: ReferenciasRepository,
    private readonly cacheService: CacheService,
    @InjectModel(Funcionario.name)
    private readonly funcionarioModel: Model<Funcionario>,
  ) {}

  async registerReference(
    payload: RegisterReferenceDto = {},
    tenantId: string | null = null,
    userId: string | null = null,
  ) {
    const { funcionarioId, name, cargo, telefone } = payload;

    if (funcionarioId) {
      return this.registerFromFuncionario(funcionarioId, tenantId, userId);
    }

    return this.registerExterna({ name, cargo, telefone }, tenantId, userId);
  }

  async registerFromFuncionario(
    funcionarioId: string,
    tenantId: string | null = null,
    userId: string | null = null,
  ) {
    const funcionario = await this.funcionarioModel
      .findOne({ _id: funcionarioId, ...tenantFilter(tenantId) })
      .lean();
    if (!funcionario) {
      throw new Error('Funcionário não encontrado!');
    }

    const alreadyLinked =
      await this.referenciasRepository.findReferenceByFuncionarioId(
        funcionarioId,
        tenantId,
      );
    if (alreadyLinked) {
      throw new Error('Este funcionário já está cadastrado como referência!');
    }

    const name = String(funcionario.nome || '')
      .trim()
      .toUpperCase();
    if (!name) {
      throw new Error('Funcionário sem nome válido!');
    }

    const existingByName = await this.referenciasRepository.findReferenceByName(
      name,
      tenantId,
    );
    if (existingByName) {
      throw new Error('Já existe uma referência com este nome!');
    }

    const newReference = await this.referenciasRepository.createReference({
      name,
      cargo: (funcionario.funcao || '').toUpperCase() || undefined,
      telefone: funcionario.telefone?.trim() || undefined,
      origem: 'funcionario',
      funcionarioId: funcionario._id,
      tenantId: toObjectId(tenantId) as never,
      createdBy: toObjectId(userId) as never,
    });

    await this.cacheService.bumpVersion(tenantId);
    return newReference;
  }

  async registerExterna(
    {
      name,
      cargo,
      telefone,
    }: { name?: string; cargo?: string; telefone?: string },
    tenantId: string | null = null,
    userId: string | null = null,
  ) {
    if (!name) {
      throw new Error('Todos os campos são obrigatórios!');
    }

    const normalizedName = String(name).trim().toUpperCase();
    const normalizedCargo = cargo?.toUpperCase();
    const normalizedTelefone = telefone?.trim();

    const existingReference = await this.referenciasRepository.findReferenceByName(
      normalizedName,
      tenantId,
    );
    if (existingReference) {
      throw new Error('Já existe uma referência com este nome e sobrenome!');
    }

    // Do not set funcionarioId (even as null) — unique index is partial on ObjectId.
    const newReference = await this.referenciasRepository.createReference({
      name: normalizedName,
      cargo: normalizedCargo,
      telefone: normalizedTelefone,
      origem: 'externa',
      tenantId: toObjectId(tenantId) as never,
      createdBy: toObjectId(userId) as never,
    });

    await this.cacheService.bumpVersion(tenantId);
    return newReference;
  }

  async getReferences(tenantId: string | null = null) {
    const key = this.referenciasRepository.cacheKeyFor(tenantId);
    return this.cacheService.getOrSetCache(key, async () => {
      return this.referenciasRepository.getAllReferences(tenantId);
    });
  }

  async deleteReference(id: string, tenantId: string | null = null) {
    const reference = await this.referenciasRepository.deleteReferenceById(
      id,
      tenantId,
    );
    if (!reference) {
      throw new Error('Referência não encontrada!');
    }

    await this.cacheService.bumpVersion(tenantId);
    return reference;
  }
}
