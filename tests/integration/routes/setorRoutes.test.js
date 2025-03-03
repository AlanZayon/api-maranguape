/* eslint-disable no-undef */
// tests/integration/routes/setorRoutes.test.js
const { describe, test, expect, beforeEach } = require('@jest/globals');
const request = require('supertest');
const app = require('../../../src/app'); // Supondo que o app esteja configurado aqui
const SetorRepository = require('../../../src/repositories/SetorRepository');
const CacheService = require('../../../src/services/CacheService');

jest.mock('../../../src/repositories/SetorRepository');
jest.mock('../../../src/services/CacheService');

describe('Setor Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /setores - deve criar um setor', async () => {
    const data = { nome: 'Setor A', tipo: 'Setor', parent: null };
    const setorMock = { _id: '1', ...data };

    SetorRepository.create.mockResolvedValue(setorMock);
    CacheService.clearCacheForSetor.mockResolvedValue(true);

    const response = await request(app).post('/api/setores').send(data);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(setorMock);
  });

  test('GET /setoresMain - deve retornar os setores principais', async () => {
    const setoresMock = [{ _id: '1', nome: 'Setor Principal' }];
    const dadosMock = { setores: setoresMock };

    CacheService.getOrSetCache.mockResolvedValue(setoresMock);

    const response = await request(app).get('/api/setores/setoresMain');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(dadosMock);
  });

  test('GET /dados/:setorId - deve retornar os dados de um setor', async () => {
    const setorId = '123';
    const dadosMock = { subsetores: [] };

    CacheService.getOrSetCache.mockResolvedValue(dadosMock);

    const response = await request(app).get(`/api/setores/dados/${setorId}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(dadosMock);
  });

  test('PUT /rename/:id - deve renomear um setor', async () => {
    const id = '123';
    const nome = 'Novo Nome';
    const setorMock = { _id: id, nome };

    SetorRepository.updateNome.mockResolvedValue(setorMock);
    CacheService.clearCacheForSetor.mockResolvedValue(true);

    const response = await request(app)
      .put(`/api/setores/rename/${id}`)
      .send({ nome });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(setorMock);
  });

  test('DELETE /del/:id - deve deletar um setor', async () => {
    const id = '123';

    SetorRepository.deleteWithChildren.mockResolvedValue(true);
    CacheService.clearCacheForSetor.mockResolvedValue(true);

    const response = await request(app).delete(`/api/setores/del/${id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'Setor e seus filhos deletados com sucesso',
    });
  });
});
