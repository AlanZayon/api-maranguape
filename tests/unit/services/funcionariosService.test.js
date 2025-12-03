/* eslint-disable no-undef */
const FuncionarioService = require('../../../src/services/funcionariosService');
const FuncionarioRepository = require('../../../src/repositories/FuncionariosRepository');
const SetorRepository = require('../../../src/repositories/SetorRepository');
const CacheService = require('../../../src/services/CacheService');
const { describe, test, expect, afterEach } = require('@jest/globals');

jest.mock('../../../src/repositories/FuncionariosRepository');
jest.mock('../../../src/repositories/SetorRepository');
jest.mock('../../../src/services/CacheService');

describe('FuncionarioService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Deve buscar todos os funcionários', async () => {
    FuncionarioRepository.findAll.mockReturnValue({
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        { _id: '1', nome: 'Teste' },
      ]),
    });

    FuncionarioRepository.countDocuments.mockResolvedValue(1);

    CacheService.getOrSetCache.mockImplementation(async (key, callback) => {
      return await callback();
    });

    const funcionarios = await FuncionarioService.buscarFuncionarios();
    expect(funcionarios.funcionarios).toHaveLength(1);
    expect(funcionarios.funcionarios[0].nome).toBe('Teste');
  });

  test('Deve criar um novo funcionário', async () => {
    const mockFuncionario = {
      _id: '2',
      nome: 'Novo Funcionario',
      coordenadoria: 'ABC',
      toObject: jest.fn().mockReturnValue({
        _id: '2',
        nome: 'Novo Funcionario',
        coordenadoria: 'ABC',
      }),
    };
    FuncionarioRepository.create.mockResolvedValue(mockFuncionario);

    SetorRepository.findSetorByCoordenadoria.mockResolvedValue([
      { parent: 'SETOR_PARENT' }
    ]);

    CacheService.clearCacheForFuncionarios = jest.fn().mockResolvedValue();

    const result = await FuncionarioService.createFuncionario({
      body: { nome: 'Novo Funcionario' },
      files: {},
    });

    expect(result).toEqual({
      _id: '2',
      nome: 'Novo Funcionario',
      coordenadoria: 'ABC',
      fotoUrl: null,
      arquivoUrl: null,
    });
    expect(FuncionarioRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Novo Funcionario' })
    );
    expect(SetorRepository.findSetorByCoordenadoria).toHaveBeenCalledWith(['ABC']);
    expect(CacheService.clearCacheForFuncionarios).toHaveBeenCalledWith('ABC', 'SETOR_PARENT');
  });

  test('Deve retornar erro ao tentar atualizar funcionário inexistente', async () => {
    FuncionarioRepository.findByIds.mockResolvedValue(null);

    await expect(FuncionarioService.execute({ id: '999' }, {}, {}))
      .rejects.toThrow('Funcionário não encontrado');
  });

});
