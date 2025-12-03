/* eslint-disable no-undef */
const request = require('supertest');
const { describe, test, expect, afterEach } = require('@jest/globals');
const app = require('../../../src/app');
const FuncionarioRepository = require('../../../src/repositories/FuncionariosRepository');

jest.mock('../../../src/repositories/FuncionariosRepository');

describe('Rotas de Funcionário', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('GET /buscarFuncionarios deve retornar funcionários', async () => {
    FuncionarioRepository.findAll.mockResolvedValue([
      { _id: '1', nome: 'Teste' },
    ]);

    const res = await request(app).get('/buscarFuncionarios');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nome).toBe('Teste');
  });

  test('POST / deve criar um funcionário', async () => {
    FuncionarioRepository.create.mockResolvedValue({
      _id: '2',
      nome: 'Novo Funcionario',
    });

    const res = await request(app).post('/').send({ nome: 'Novo Funcionario' });

    expect(res.status).toBe(201);
    expect(res.body.nome).toBe('Novo Funcionario');
  });

  test('PUT /edit-funcionario/:id deve retornar erro se funcionário não existir', async () => {
    FuncionarioRepository.findByIds.mockResolvedValue(null);

    const res = await request(app)
      .put('/edit-funcionario/999')
      .send({ nome: 'Novo Nome' });

      console.log(res.body);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Funcionário não encontrado');
  });
});
