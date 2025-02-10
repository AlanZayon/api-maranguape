const path = require('path');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const dbFuncionarios = require('../config/Mongoose/funcionariosConnection');
const Setor = require('../models/setoresSchema');
const Funcionario = require('../models/funcionariosSchema');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/aws'); 

let s3FilesToDelete = [];


describe('Testes de criação de Setor e Funcionario', () => {
  // Limpa o banco de dados após cada teste
  afterEach(async () => {
    await Setor.deleteMany({});
    await Funcionario.deleteMany({});
  });

  // Fecha a conexão com o MongoDB após todos os testes
  afterAll(async () => {
    await dbFuncionarios.close();
    await mongoose.disconnect();

     // Exclui os arquivos do S3 após cada teste
     for (const fileKey of s3FilesToDelete) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: 'system-maranguape', // Substitua pelo seu bucket
        Key: fileKey,
      }));
    }
    // Limpa a lista de arquivos
    s3FilesToDelete = [];
  });

  test('Deve criar um Setor', async () => {
    const response = await request(app)
      .post('/api/setores')
      .send({
        nome: 'Financeiro',
        tipo: 'Setor',
      });
    expect(response.status).toBe(201);
    expect(response.body.nome).toBe('Financeiro');
    expect(response.body.tipo).toBe('Setor');
  });

  test('Deve criar um Subsetor com referência ao Setor pai', async () => {
    const setorPai = await Setor.create({
      nome: 'Financeiro',
      tipo: 'Setor',
    });

    const response = await request(app)
      .post('/api/setores')
      .send({
        nome: 'Contabilidade',
        tipo: 'Subsetor',
        parent: setorPai._id,
      });

    expect(response.status).toBe(201);
    expect(response.body.nome).toBe('Contabilidade');
    expect(response.body.tipo).toBe('Subsetor');
    expect(response.body.parent).toBe(String(setorPai._id));
  });

  test('Deve falhar ao tentar criar um Subsetor sem setor pai', async () => {
    const response = await request(app)
      .post('/api/setores')
      .send({
        nome: 'Subsetor de TI',
        tipo: 'Subsetor',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Erro de validação');
  });


  test('Deve criar uma Coordenadoria com setor pai válido', async () => {
    const setorPai = await Setor.create({
      nome: 'Financeiro',
      tipo: 'Setor',
    });

    const response = await request(app)
      .post('/api/setores')
      .send({
        nome: 'Coordenação de TI',
        tipo: 'Coordenadoria',
        parent: setorPai._id,
      });

    expect(response.status).toBe(201);
    expect(response.body.nome).toBe('Coordenação de TI');
    expect(response.body.tipo).toBe('Coordenadoria');
    expect(response.body.parent).toBe(String(setorPai._id));
  });

  test('Deve falhar ao tentar criar uma Coordenadoria sem setor pai', async () => {
    const response = await request(app)
      .post('/api/setores')
      .send({
        nome: 'Coordenação de TI',
        tipo: 'Coordenadoria',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Erro de validação');
  });

  test('Deve criar um Funcionario vinculado a uma Coordenadoria', async () => {
    const coordenadoria = await Setor.create({
      nome: 'Coordenação de TI',
      tipo: 'Coordenadoria',
      parent: new mongoose.Types.ObjectId() // ID do setor ou subsetor pai
    });

    const response = await request(app)
    .post('/api/funcionarios')
    .field('nome', 'João Silva')
    .field('secretaria', 'Tecnologia da Informação')
    .field('funcao', 'Analista de Sistemas')
    .field('natureza', 'Efetivo')
    .field('referencia', 'Nível 5')
    .field('redesSociais[]', 'http://linkedin.com/joaosilva')
    .field('salarioBruto', 5000)
    .field('salarioLiquido', 4000)
    .field('endereco', 'Rua das Flores, 123')
    .field('bairro', 'Centro')
    .field('telefone', '123456789')
    .field('observacoes[]', 'Ótimo profissional')
    .attach('arquivo', path.join(__dirname, 'fixtures','gabcom_organograma-2.pdf'))
    .field('coordenadoria', String(coordenadoria._id))
    .attach('foto', path.join(__dirname, 'fixtures','90863724.jpg'));

    expect(response.status).toBe(201);
    expect(response.body.nome).toBe('João Silva');
    expect(response.body.coordenadoria).toBe(String(coordenadoria._id));
  });

  test('Deve falhar ao tentar criar um Funcionario sem uma Coordenadoria válida', async () => {
    const response = await request(app)
    .post('/api/funcionarios')
    .field('nome', 'João Silva')
    .field('secretaria', 'Tecnologia da Informação')
    .field('funcao', 'Analista de Sistemas')
    .field('natureza', 'Efetivo')
    .field('referencia', 'Nível 5')
    .field('redesSociais[]', 'http://linkedin.com/joaosilva')
    .field('salarioBruto', 5000)
    .field('salarioLiquido', 4000)
    .field('endereco', 'Rua das Flores, 123')
    .field('bairro', 'Centro')
    .field('telefone', '123456789')
    .field('observacoes[]', 'Ótimo profissional')
    .attach('arquivo', path.join(__dirname, 'fixtures','gabcom_organograma-2.pdf'))
    .attach('foto', path.join(__dirname, 'fixtures','90863724.jpg'))
    .field('coordenadoria', new mongoose.Types.ObjectId().toString());

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Coordenadoria inválida');
  });
});
