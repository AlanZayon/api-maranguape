/* eslint-disable no-undef */
// tests/unit/controllers/setorController.test.js
const { describe, test, expect } = require('@jest/globals');
const request = require('supertest');
const app = require('../../../src/app'); // A configuração do Express
const SetorService = require('../../../src/services/SetorService');

// Mocking do SetorService
jest.mock('../../../src/services/SetorService');

describe('SetorController', () => {
  describe('POST /setor', () => {
    test('deve criar um setor com sucesso', async () => {
      const data = { nome: 'Setor A', tipo: 'Setor', parent: null };
      const setorMock = { _id: '1', ...data };

      SetorService.createSetor.mockResolvedValue(setorMock);

      const response = await request(app).post('/api/setores').send(data);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(setorMock);
      expect(SetorService.createSetor).toHaveBeenCalledWith(data);
    });

    test('deve retornar erro ao tentar criar setor', async () => {
      const data = { nome: 'Setor A', tipo: 'Setor', parent: null };

      SetorService.createSetor.mockRejectedValue(
        new Error('Erro ao criar setor')
      );

      const response = await request(app).post('/api/setores').send(data);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Erro ao criar setor');
    });
  });

  describe('GET /setoresMain', () => {
    test('deve retornar os setores principais com sucesso', async () => {
      const setoresMock = [{ _id: '1', nome: 'Setor Principal' }];
      const setores = { setores: setoresMock };

      SetorService.getMainSetores.mockResolvedValue(setoresMock);

      const response = await request(app).get('/api/setores/setoresMain');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(setores);
      expect(SetorService.getMainSetores).toHaveBeenCalled();
    });

    test('deve retornar erro ao tentar obter setores principais', async () => {
      SetorService.getMainSetores.mockRejectedValue(
        new Error('Erro ao obter setores')
      );

      const response = await request(app).get('/api/setores/setoresMain');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Erro ao buscar setores');
    });
  });

  describe('GET /dados/:setorId', () => {
    test('deve retornar os dados de um setor com sucesso', async () => {
      const setorId = '123';
      const dadosMock = { subsetores: [] };

      SetorService.getSetorData.mockResolvedValue(dadosMock);

      const response = await request(app).get(`/api/setores/dados/${setorId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(dadosMock);
      expect(SetorService.getSetorData).toHaveBeenCalledWith(setorId);
    });

    test('deve retornar erro ao tentar obter dados de um setor', async () => {
      const setorId = '123';

      SetorService.getSetorData.mockRejectedValue(
        new Error('Erro ao buscar dados do setor')
      );

      const response = await request(app).get(`/api/setores/dados/${setorId}`);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Erro ao buscar dados do setor');
    });
  });

  describe('PUT /rename/:id', () => {
    test('deve renomear um setor com sucesso', async () => {
      const id = '123';
      const nome = 'Novo Nome';
      const setorMock = { _id: id, nome };

      SetorService.renameSetor.mockResolvedValue(setorMock);

      const response = await request(app)
        .put(`/api/setores/rename/${id}`)
        .send({ nome });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(setorMock);
      expect(SetorService.renameSetor).toHaveBeenCalledWith(id, nome);
    });

    test('deve retornar erro ao tentar renomear um setor', async () => {
      const id = '123';
      const nome = 'Novo Nome';

      SetorService.renameSetor.mockRejectedValue(
        new Error('Erro ao atualizar o setor')
      );

      const response = await request(app)
        .put(`/api/setores/rename/${id}`)
        .send({ nome });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Erro ao atualizar o setor');
    });
  });

  describe('DELETE /del/:id', () => {
    test('deve deletar um setor com sucesso', async () => {
      const id = '123';

      SetorService.deleteSetor.mockResolvedValue(true);

      const response = await request(app).delete(`/api/setores/del/${id}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        'Setor e seus filhos deletados com sucesso'
      );
      expect(SetorService.deleteSetor).toHaveBeenCalledWith(id);
    });

    test('deve retornar erro ao tentar deletar um setor', async () => {
      const id = '123';

      SetorService.deleteSetor.mockRejectedValue(
        new Error('Erro ao deletar o setor e seus filhosr')
      );

      const response = await request(app).delete(`/api/setores/del/${id}`);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        'Erro ao deletar o setor e seus filhos'
      );
    });
  });
});
