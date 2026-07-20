import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reference } from './schemas/referencia.schema';
import { tenantFilter, cacheKey } from '../../common/utils/tenant.helpers';

@Injectable()
export class ReferenciasRepository {
  constructor(
    @InjectModel(Reference.name)
    private readonly referenceModel: Model<Reference>,
  ) {}

  cacheKeyFor(tenantId: string | null): string {
    return cacheKey(tenantId, 'referencias-dados');
  }

  async findReferenceByName(name: string, tenantId: string | null = null) {
    return this.referenceModel.findOne({ name, ...tenantFilter(tenantId) });
  }

  async findReferenceByFuncionarioId(
    funcionarioId: string,
    tenantId: string | null = null,
  ) {
    return this.referenceModel.findOne({
      funcionarioId,
      ...tenantFilter(tenantId),
    });
  }

  async createReference(referenceData: Partial<Reference>) {
    const payload = { ...referenceData } as Record<string, unknown>;
    if (payload.funcionarioId == null) {
      delete payload.funcionarioId;
    }
    const newReference = new this.referenceModel(payload);
    return newReference.save();
  }

  async getAllReferences(tenantId: string | null = null) {
    return this.referenceModel.find(tenantFilter(tenantId)).sort({ name: 1 });
  }

  async deleteReferenceById(id: string, tenantId: string | null = null) {
    return this.referenceModel.findOneAndDelete({
      _id: id,
      ...tenantFilter(tenantId),
    });
  }
}
