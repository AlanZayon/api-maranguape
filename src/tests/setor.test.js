const request = require('supertest');
const app = require('../app');  // Substitua pelo seu app Express
const Setor = require('../models/setoresSchema');  // Importa o modelo de Setor
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;
let setorId;
let subSetorId;
let coordenadoriaId;

describe('Testes de Setores', () => {

  // Criação do setor no beforeAll, para garantir que o ID será utilizado nos testes seguintes
  beforeAll(async () => {

    // Configuração do MongoDB em memória
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    await mongoose.connect(uri);

    const novoSetor = {
      nome: 'Setor Teste',
      tipo: 'Setor',
      parent: null, // Primeiro setor sem parent
    };

    const response = await request(app)
      .post('/api/setores')
      .send(novoSetor)
      .set('Accept', 'application/json');

    setorId = response.body._id; // Armazena o ID do primeiro setor

    // Criar um novo setor utilizando o ID do primeiro setor como parent
    const subSetor = {
      nome: 'SubSetor Teste',
      tipo: 'Subsetor',
      parent: setorId, // Usa o ID do primeiro setor como parent
    };

    const responseSubSetor = await request(app)
      .post('/api/setores')
      .send(subSetor)
      .set('Accept', 'application/json');

    subSetorId = responseSubSetor.body._id; // Armazena o ID do subsetor criado

    // Criar um novo setor utilizando o ID do primeiro setor como parent
    const coordenadoria = {
      nome: 'Coordenadoria Teste',
      tipo: 'Coordenadoria',
      parent: subSetorId, // Usa o ID do primeiro setor como parent
    };

    const responseCoordenadoria = await request(app)
      .post('/api/setores')
      .send(coordenadoria)
      .set('Accept', 'application/json');

    coordenadoriaId = responseCoordenadoria.body._id; // Armazena o ID do subsetor criado
  });

  // Teste para verificar setor
  it('deve verificar o setor criado', async () => {
    expect(subSetorId).toBeDefined();

    const response = await request(app)
      .get(`/api/setores/dados/${subSetorId}`)
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('subsetores');
    expect(response.body).toHaveProperty('coordenadoriasComFuncionarios');
  });

  // Teste para buscar os setores organizados
  it('deve retornar a lista de setores organizados', async () => {
    const response = await request(app)
      .get('/api/setores/setoresMain')
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('setores');
    expect(Array.isArray(response.body.setores)).toBe(true);
  });

  // Teste para buscar um setor específico com o ID criado
  it('deve retornar dados de um setor específico', async () => {
    const response = await request(app)
      .get(`/api/setores/dados/${subSetorId}`)
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('subsetores');
    expect(response.body).toHaveProperty('coordenadoriasComFuncionarios');
  });

  // teste de rename
  it('deve renomear o setor', async () => {
    const novoNome = 'Setor Renomeado';
    const response = await request(app)
      .put(`/api/setores/rename/${setorId}`)
      .send({ nome: novoNome })
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('_id', setorId);
    expect(response.body).toHaveProperty('nome', novoNome);
  });

  // Teste para deletar um setor
  it('deve deletar um setor existente', async () => {
    const response = await request(app)
      .delete(`/api/setores/del/${setorId}`)
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Setor e seus filhos deletados com sucesso');

    // Verifica se o setor foi removido
    const setorRemovido = await Setor.findById(setorId);
    expect(setorRemovido).toBeNull();
  });


  // Limpeza dos dados criados após os testes
  afterAll(async () => {
    if (setorId || subSetorId) {
      await Setor.findByIdAndDelete(setorId);
      await Setor.findByIdAndDelete(subSetorId);
    }
    await mongoose.disconnect();
    await mongoServer.stop();
  });
});
