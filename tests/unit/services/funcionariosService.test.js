/* eslint-disable no-undef */
const FuncionarioService = require('../../../src/services/funcionariosService');
const FuncionarioRepository = require('../../../src/repositories/FuncionariosRepository');
const { describe, test, expect, afterEach } = require('@jest/globals');

jest.mock('../../../src/repositories/FuncionariosRepository');

describe('FuncionarioService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Deve buscar todos os funcionários', async () => {
    FuncionarioRepository.findAll.mockResolvedValue([
      { _id: '1', nome: 'Teste' },
    ]);

    const funcionarios = await FuncionarioService.buscarFuncionarios();
    expect(funcionarios).toHaveLength(1);
    expect(funcionarios[0].nome).toBe('Teste');
  });

  test('Deve criar um novo funcionário', async () => {
    const mockFuncionario = { _id: '2', nome: 'Novo Funcionario' };
    FuncionarioRepository.create.mockResolvedValue(mockFuncionario);

    const result = await FuncionarioService.createFuncionario({
      body: { nome: 'Novo Funcionario' },
      files: {},
    });

    expect(result).toEqual(mockFuncionario);
    expect(FuncionarioRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Novo Funcionario' })
    );
  });

  test('Deve retornar erro ao tentar atualizar funcionário inexistente', async () => {
    FuncionarioRepository.findByIds.mockResolvedValue(null);

    const result = await FuncionarioService.execute({ id: '999' }, {}, {});

    expect(result.status).toBe(404);
    expect(result.data.error).toBe('Funcionário não encontrado');
  });
});
