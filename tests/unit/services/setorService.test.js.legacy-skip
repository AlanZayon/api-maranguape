/* eslint-disable no-undef */
const { describe, test, expect, beforeEach } = require('@jest/globals');

jest.mock('../../../src/repositories/SetorRepository');
jest.mock('../../../src/repositories/FuncionariosRepository');
jest.mock('../../../src/services/CacheService');
jest.mock('../../../src/services/auditService', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}));

const SetorService = require('../../../src/services/SetorService');
const SetorRepository = require('../../../src/repositories/SetorRepository');
const FuncionarioRepository = require('../../../src/repositories/FuncionariosRepository');
const CacheService = require('../../../src/services/CacheService');

describe('SetorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deve criar um setor corretamente', async () => {
    const data = { nome: 'Setor A', tipo: 'Setor', parent: null };
    const setorMock = { _id: '1', nome: 'SETOR A', tipo: 'Setor', parent: null };

    SetorRepository.create.mockResolvedValue(setorMock);
    CacheService.clearCacheForSetor.mockResolvedValue(true);

    const setor = await SetorService.createSetor(data);

    expect(SetorRepository.create).toHaveBeenCalledWith({
      nome: 'SETOR A',
      tipo: 'Setor',
      parent: null,
    });
    expect(CacheService.clearCacheForSetor).toHaveBeenCalledWith('1', null);
    expect(setor).toEqual(setorMock);
  });

  test('deve limpar cache do parent e do novo setor', async () => {
    const data = { nome: 'Filho', tipo: 'Subsetor', parent: 'parent1' };
    const setorMock = { _id: '2', ...data, nome: 'FILHO' };

    SetorRepository.findById.mockResolvedValue({
      _id: 'parent1',
      nome: 'PAI',
      tipo: 'Setor',
    });
    SetorRepository.create.mockResolvedValue(setorMock);
    CacheService.clearCacheForSetor.mockResolvedValue(true);

    await SetorService.createSetor(data);

    expect(CacheService.clearCacheForSetor).toHaveBeenCalledWith('parent1', null);
    expect(CacheService.clearCacheForSetor).toHaveBeenCalledWith('2', null);
  });

  test('deve obter os setores principais', async () => {
    const setoresMock = [{ _id: '1', nome: 'Setor Principal' }];

    CacheService.getOrSetCache.mockResolvedValue(setoresMock);
    const setores = await SetorService.getMainSetores();

    expect(CacheService.getOrSetCache).toHaveBeenCalledWith(
      'setores:null',
      expect.any(Function)
    );
    expect(setores).toEqual(setoresMock);
  });

  test('deve obter dados do setor', async () => {
    const setorId = '123';
    const dadosMock = { subsetores: [] };

    CacheService.getOrSetCache.mockResolvedValue(dadosMock);
    const dados = await SetorService.getSetorData(setorId);

    expect(CacheService.getOrSetCache).toHaveBeenCalledWith(
      `setor:${setorId}:dados`,
      expect.any(Function)
    );
    expect(dados).toEqual(dadosMock);
  });

  test('deve renomear o setor corretamente', async () => {
    const id = '123';
    const nome = 'Novo Nome';
    const parentId = '456';
    const setorMock = { _id: id, nome: 'NOVO NOME', parent: parentId };

    SetorRepository.updateNome.mockResolvedValue(setorMock);
    CacheService.clearCacheForSetor.mockResolvedValue(true);

    const setor = await SetorService.renameSetor(id, nome);

    expect(SetorRepository.updateNome).toHaveBeenCalledWith(
      id,
      'NOVO NOME',
      {},
      null
    );
    expect(CacheService.clearCacheForSetor).toHaveBeenCalledWith(parentId, null);
    expect(CacheService.clearCacheForSetor).toHaveBeenCalledWith(id, null);
    expect(setor).toEqual(setorMock);
  });

  test('deve deletar o setor corretamente quando sem funcionários', async () => {
    const id = '123';

    SetorRepository.findById.mockResolvedValue({ _id: id, nome: 'S' });
    SetorRepository.getDescendantIds.mockResolvedValue([id]);
    FuncionarioRepository.countFuncionariosInSetores.mockResolvedValue(0);
    SetorRepository.deleteWithChildren.mockResolvedValue(true);
    CacheService.clearCacheForSetor.mockResolvedValue(true);

    await SetorService.deleteSetor(id);

    expect(SetorRepository.deleteWithChildren).toHaveBeenCalledWith(id, null);
    expect(CacheService.clearCacheForSetor).toHaveBeenCalledWith(id, null);
  });

  test('deve bloquear exclusão quando há funcionários', async () => {
    const id = '123';

    SetorRepository.findById.mockResolvedValue({ _id: id, nome: 'S' });
    SetorRepository.getDescendantIds.mockResolvedValue([id]);
    FuncionarioRepository.countFuncionariosInSetores.mockResolvedValue(2);

    await expect(SetorService.deleteSetor(id)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Não é possível excluir: existem funcionários vinculados',
    });
    expect(SetorRepository.deleteWithChildren).not.toHaveBeenCalled();
  });

  test('deve mover setor para outro pai', async () => {
    const id = 'child1';
    const oldParent = 'parent1';
    const newParent = 'parent2';
    const setor = { _id: id, nome: 'FILHO', tipo: 'Subsetor', parent: oldParent };
    const updated = { ...setor, parent: newParent };

    SetorRepository.findById
      .mockResolvedValueOnce(setor)
      .mockResolvedValueOnce({ _id: newParent, nome: 'PAI 2', tipo: 'Setor' });
    SetorRepository.getDescendantIds.mockResolvedValue([id]);
    SetorRepository.updateParent.mockResolvedValue(updated);
    CacheService.clearCacheForSetor.mockResolvedValue(true);

    const result = await SetorService.moveSetor(id, newParent, {
      userId: 'u1',
      tenantId: 't1',
    });

    expect(SetorRepository.updateParent).toHaveBeenCalledWith(
      id,
      newParent,
      {
        updatedBy: 'u1',
      },
      't1'
    );
    expect(CacheService.clearCacheForSetor).toHaveBeenCalledWith(oldParent, 't1');
    expect(CacheService.clearCacheForSetor).toHaveBeenCalledWith(newParent, 't1');
    expect(CacheService.clearCacheForSetor).toHaveBeenCalledWith(id, 't1');
    expect(result).toEqual(updated);
  });

  test('deve bloquear move para dentro da própria subárvore', async () => {
    const id = 'parent';
    const childId = 'child';
    const setor = { _id: id, nome: 'PAI', tipo: 'Setor', parent: null };

    SetorRepository.findById.mockResolvedValue(setor);
    SetorRepository.getDescendantIds.mockResolvedValue([id, childId]);

    await expect(SetorService.moveSetor(id, childId)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Não é possível mover um nó para dentro da própria subárvore',
    });
    expect(SetorRepository.updateParent).not.toHaveBeenCalled();
  });

  test('deve promover Setor a raiz', async () => {
    const id = 's1';
    const setor = { _id: id, nome: 'S', tipo: 'Setor', parent: 'p1' };
    const updated = { ...setor, parent: null };

    SetorRepository.findById.mockResolvedValue(setor);
    SetorRepository.updateParent.mockResolvedValue(updated);
    CacheService.clearCacheForSetor.mockResolvedValue(true);

    const result = await SetorService.moveSetor(id, null);

    expect(SetorRepository.updateParent).toHaveBeenCalledWith(id, null, {}, null);
    expect(result.parent).toBeNull();
  });

  test('não deve promover Subsetor a raiz', async () => {
    const id = 's1';
    const setor = { _id: id, nome: 'S', tipo: 'Subsetor', parent: 'p1' };

    SetorRepository.findById.mockResolvedValue(setor);

    await expect(SetorService.moveSetor(id, null)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
