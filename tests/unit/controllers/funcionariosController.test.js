/* eslint-disable no-undef */
const { describe, test, expect, beforeEach } = require('@jest/globals');
const FuncionarioController = require('../../../src/controllers/funcionariosController');
const FuncionarioService = require('../../../src/services/funcionariosService');
const httpMocks = require('node-mocks-http');

jest.mock('../../../src/services/funcionariosService.js');
jest.mock('../../../src/utils/Logger.js');

describe('FuncionarioController', () => {
  let req, res;

  beforeEach(() => {
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
  });

  test('buscarFuncionarios - deve retornar a lista de funcionários', async () => {
    const mockFuncionarios = [{ id: 1, nome: 'Teste' }];
    FuncionarioService.buscarFuncionarios.mockResolvedValue(mockFuncionarios);
    await FuncionarioController.buscarFuncionarios(req, res);
    expect(res._getJSONData()).toEqual(mockFuncionarios);
    expect(res.statusCode).toBe(200);
  });

  test('buscarFuncionarios - deve retornar erro 500 ao falhar', async () => {
    FuncionarioService.buscarFuncionarios.mockRejectedValue(new Error('Erro'));
    await FuncionarioController.buscarFuncionarios(req, res);
    expect(res.statusCode).toBe(500);
  });

  test('buscarFuncionariosPorCoordenadoria - deve retornar funcionários', async () => {
    FuncionarioService.buscarFuncionariosPorCoordenadoria.mockResolvedValue([
      { id: 1, nome: 'Teste' },
    ]);
    await FuncionarioController.buscarFuncionariosPorCoordenadoria(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('buscarFuncionariosPorCoordenadoria - deve retornar erro 500 ao falhar', async () => {
    FuncionarioService.buscarFuncionariosPorCoordenadoria.mockRejectedValue(
      new Error('Erro')
    );
    await FuncionarioController.buscarFuncionariosPorCoordenadoria(req, res);
    expect(res.statusCode).toBe(500);
  });

  test('createFuncionario - deve criar um funcionário', async () => {
    const mockFuncionario = { id: 1, nome: 'Novo' };
    FuncionarioService.createFuncionario.mockResolvedValue(mockFuncionario);
    await FuncionarioController.createFuncionario(req, res);
    expect(res.statusCode).toBe(201);
  });

  test('createFuncionario - deve retornar erro 500 ao falhar', async () => {
    FuncionarioService.createFuncionario.mockRejectedValue(new Error('Erro'));
    await FuncionarioController.createFuncionario(req, res);
    expect(res.statusCode).toBe(500);
  });

  test('updateFuncionario - deve atualizar funcionário', async () => {
    req.params = { id: 1 };
    req.body = { nome: 'Atualizado' };
    const mockResponse = { status: 200, data: { sucesso: true } };
    FuncionarioService.execute.mockResolvedValue(mockResponse);
    await FuncionarioController.updateFuncionario(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('updateFuncionario - deve retornar erro 500 ao falhar', async () => {
    FuncionarioService.execute.mockRejectedValue(new Error('Erro'));
    await FuncionarioController.updateFuncionario(req, res);
    expect(res.statusCode).toBe(500);
  });

  test('deleteUsers - deve deletar usuários', async () => {
    req.body = { userIds: [1, 2] };
    FuncionarioService.deleteUsers.mockResolvedValue({ sucesso: true });
    await FuncionarioController.deleteUsers(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('deleteUsers - deve retornar erro 500 ao falhar', async () => {
    req.body = { userIds: [1, 2] };
    FuncionarioService.deleteUsers.mockRejectedValue(new Error('Erro'));
    await FuncionarioController.deleteUsers(req, res);
    expect(res.statusCode).toBe(500);
  });

  test('updateCoordenadoria - deve atualizar coordenadoria', async () => {
    req.body = { userIds: [1], newCoordId: 2 };
    FuncionarioService.updateCoordinatoria.mockResolvedValue({ sucesso: true });
    await FuncionarioController.updateCoordenadoria(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('updateCoordenadoria - deve retornar erro 500 ao falhar', async () => {
    FuncionarioService.updateCoordinatoria.mockRejectedValue(new Error('Erro'));
    await FuncionarioController.updateCoordenadoria(req, res);
    expect(res.statusCode).toBe(500);
  });

  test('updateObservacoes - deve atualizar observações', async () => {
    req.params = { userId: 1 };
    req.body = { observacoes: 'Nova observação' };
    FuncionarioService.updateObservacoes.mockResolvedValue({
      observacoes: 'Nova observação',
    });
    await FuncionarioController.updateObservacoes(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('updateObservacoes - deve retornar erro 500 ao falhar', async () => {
    FuncionarioService.updateObservacoes.mockRejectedValue(new Error('Erro'));
    await FuncionarioController.updateObservacoes(req, res);
    expect(res.statusCode).toBe(500);
  });
});
