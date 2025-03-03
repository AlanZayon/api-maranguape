/* eslint-disable no-undef */
// tests/unit/services/setorService.test.js
const { describe, test, expect, beforeEach } = require('@jest/globals');
const SetorService = require('../../../src/services/SetorService');
const SetorRepository = require('../../../src/repositories/SetorRepository');
const CacheService = require('../../../src/services/CacheService');

// Mocking dos repositórios e serviços
jest.mock('../../../src/repositories/SetorRepository');
jest.mock('../../../src/services/CacheService');

describe('SetorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deve criar um setor corretamente', async () => {
    const data = { nome: 'Setor A', tipo: 'Setor', parent: null };
    const setorMock = { _id: '1', ...data };

    SetorRepository.create.mockResolvedValue(setorMock);
    CacheService.clearCacheForSetor.mockResolvedValue(true);

    const setor = await SetorService.createSetor(data);

    expect(SetorRepository.create).toHaveBeenCalledWith(data);
    expect(CacheService.clearCacheForSetor).toHaveBeenCalledWith(null, '1');
    expect(setor).toEqual(setorMock);
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
    const setorMock = { _id: id, nome, parent: parentId };

    SetorRepository.updateNome.mockResolvedValue(setorMock);
    CacheService.clearCacheForSetor.mockResolvedValue(true);

    const setor = await SetorService.renameSetor(id, nome);

    expect(SetorRepository.updateNome).toHaveBeenCalledWith(id, nome);
    expect(CacheService.clearCacheForSetor).toHaveBeenCalledWith(parentId);
    expect(setor).toEqual(setorMock);
  });

  test('deve deletar o setor corretamente', async () => {
    const id = '123';

    SetorRepository.deleteWithChildren.mockResolvedValue(true);
    CacheService.clearCacheForSetor.mockResolvedValue(true);

    await SetorService.deleteSetor(id);

    expect(SetorRepository.deleteWithChildren).toHaveBeenCalledWith(id);
    expect(CacheService.clearCacheForSetor).toHaveBeenCalledWith(id);
  });
});
