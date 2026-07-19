/* eslint-disable no-undef */
const { describe, test, expect, beforeEach } = require('@jest/globals');
const FuncionarioController = require('../../../src/controllers/funcionariosController');
const FuncionarioService = require('../../../src/services/funcionariosService');
const httpMocks = require('node-mocks-http');

jest.mock('../../../src/services/funcionariosService.js');
jest.mock('../../../src/utils/Logger.js');
jest.mock('../../../src/queues/bulkQueue', () => ({
  BULK_SYNC_THRESHOLD: 200,
  enqueueDeleteUsers: jest.fn(),
  enqueueExportCsv: jest.fn(),
  getJobStatus: jest.fn(),
}));

describe('FuncionarioController', () => {
  let req, res, next;

  beforeEach(() => {
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    next = jest.fn();
  });

  test('buscarFuncionarios - deve retornar a lista de funcionários', async () => {
    const mockFuncionarios = [{ id: 1, nome: 'Teste' }];
    FuncionarioService.buscarFuncionarios.mockResolvedValue(mockFuncionarios);
    await FuncionarioController.buscarFuncionarios(req, res, next);
    expect(res._getJSONData()).toEqual(mockFuncionarios);
    expect(res.statusCode).toBe(200);
  });

  test('buscarFuncionarios - deve chamar next ao falhar', async () => {
    const err = new Error('Erro');
    FuncionarioService.buscarFuncionarios.mockRejectedValue(err);
    await FuncionarioController.buscarFuncionarios(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test('buscarFuncionariosPorCoordenadoria - deve retornar funcionários', async () => {
    FuncionarioService.buscarFuncionariosPorCoordenadoria.mockResolvedValue([
      { id: 1, nome: 'Teste' },
    ]);
    await FuncionarioController.buscarFuncionariosPorCoordenadoria(
      req,
      res,
      next
    );
    expect(res.statusCode).toBe(200);
  });

  test('buscarFuncionariosPorCoordenadoria - deve chamar next ao falhar', async () => {
    const err = new Error('Erro');
    FuncionarioService.buscarFuncionariosPorCoordenadoria.mockRejectedValue(
      err
    );
    await FuncionarioController.buscarFuncionariosPorCoordenadoria(
      req,
      res,
      next
    );
    expect(next).toHaveBeenCalledWith(err);
  });

  test('createFuncionario - deve criar um funcionário', async () => {
    const mockFuncionario = { id: 1, nome: 'Novo' };
    FuncionarioService.createFuncionario.mockResolvedValue(mockFuncionario);
    await FuncionarioController.createFuncionario(req, res, next);
    expect(res.statusCode).toBe(201);
  });

  test('createFuncionario - deve chamar next ao falhar', async () => {
    const err = new Error('Erro');
    FuncionarioService.createFuncionario.mockRejectedValue(err);
    await FuncionarioController.createFuncionario(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test('updateFuncionario - deve atualizar funcionário', async () => {
    req.params = { id: 1 };
    req.body = { nome: 'Atualizado' };
    const mockResponse = { status: 200, data: { sucesso: true } };
    FuncionarioService.execute.mockResolvedValue(mockResponse);
    await FuncionarioController.updateFuncionario(req, res, next);
    expect(res.statusCode).toBe(200);
  });

  test('updateFuncionario - deve chamar next ao falhar', async () => {
    const err = new Error('Erro');
    FuncionarioService.execute.mockRejectedValue(err);
    await FuncionarioController.updateFuncionario(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test('deleteUsers - deve deletar usuários', async () => {
    req.body = { userIds: [1, 2] };
    FuncionarioService.deleteUsers.mockResolvedValue({ sucesso: true });
    await FuncionarioController.deleteUsers(req, res, next);
    expect(res.statusCode).toBe(200);
  });

  test('deleteUsers - deve chamar next ao falhar', async () => {
    req.body = { userIds: [1, 2] };
    const err = new Error('Erro');
    FuncionarioService.deleteUsers.mockRejectedValue(err);
    await FuncionarioController.deleteUsers(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test('updateCoordenadoria - deve atualizar lotação', async () => {
    req.body = { usuariosIds: [1], coordenadoriaId: 2 };
    FuncionarioService.updateLotacao.mockResolvedValue({ sucesso: true });
    await FuncionarioController.updateCoordenadoria(req, res, next);
    expect(FuncionarioService.updateLotacao).toHaveBeenCalledWith([1], 2, null);
    expect(res.statusCode).toBe(200);
  });

  test('updateCoordenadoria - deve chamar next ao falhar', async () => {
    const err = new Error('Erro');
    FuncionarioService.updateLotacao.mockRejectedValue(err);
    await FuncionarioController.updateCoordenadoria(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test('updateObservacoes - deve atualizar observações', async () => {
    req.params = { userId: 1 };
    req.body = { observacoes: 'Nova observação' };
    FuncionarioService.updateObservacoes.mockResolvedValue({
      observacoes: 'Nova observação',
    });
    await FuncionarioController.updateObservacoes(req, res, next);
    expect(res.statusCode).toBe(200);
  });

  test('updateObservacoes - deve chamar next ao falhar', async () => {
    const err = new Error('Erro');
    FuncionarioService.updateObservacoes.mockRejectedValue(err);
    await FuncionarioController.updateObservacoes(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
