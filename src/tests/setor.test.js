const request = require("supertest");
const app = require("../app");
const mongooseUsuarios = require("../config/Mongoose/usuariosConnection");
const mongooseFuncionarios = require("../config/Mongoose/funcionariosConnection");
const mongoose = require("mongoose");
const Setor = require("../models/setoresSchema");
const redisClient = require("../config/redisClient");

let setorId;
let subSetorId;

describe("Testes de Setores", () => {
  // Criação do setor no beforeAll, para garantir que o ID será utilizado nos testes seguintes
  beforeAll(async () => {
    const novoSetor = {
      nome: "Setor Teste",
      tipo: "Setor",
      parent: null,
    };

    const response = await request(app)
      .post("/api/setores")
      .send(novoSetor)
      .set("Accept", "application/json");

    setorId = response.body._id;

    // Criar um novo setor utilizando o ID do primeiro setor como parent
    const subSetor = {
      nome: "SubSetor Teste",
      tipo: "Subsetor",
      parent: setorId,
    };

    const responseSubSetor = await request(app)
      .post("/api/setores")
      .send(subSetor)
      .set("Accept", "application/json");

    subSetorId = responseSubSetor.body._id;

    // Criar um novo setor utilizando o ID do primeiro setor como parent
    const coordenadoria = {
      nome: "Coordenadoria Teste",
      tipo: "Coordenadoria",
      parent: subSetorId,
    };

    const responseCoordenadoria = await request(app)
      .post("/api/setores")
      .send(coordenadoria)
      .set("Accept", "application/json");
  });

  // Teste para verificar setor
  it("deve verificar o setor criado", async () => {
    expect(subSetorId).toBeDefined();

    const response = await request(app)
      .get(`/api/setores/dados/${subSetorId}`)
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("subsetores");
    expect(response.body).toHaveProperty("coordenadoriasComFuncionarios");
  });

  // Teste para buscar os setores organizados
  it("deve retornar a lista de setores organizados", async () => {
    const response = await request(app)
      .get("/api/setores/setoresMain")
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("setores");
    expect(Array.isArray(response.body.setores)).toBe(true);
  });

  // Teste para buscar um setor específico com o ID criado
  it("deve retornar dados de um setor específico", async () => {
    const response = await request(app)
      .get(`/api/setores/dados/${subSetorId}`)
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("subsetores");
    expect(response.body).toHaveProperty("coordenadoriasComFuncionarios");
  });

  // teste de rename
  it("deve renomear o setor", async () => {
    const novoNome = "Setor Renomeado";
    const response = await request(app)
      .put(`/api/setores/rename/${setorId}`)
      .send({ nome: novoNome })
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("_id", setorId);
    expect(response.body).toHaveProperty("nome", novoNome);
  });

  // Teste para deletar um setor
  it("deve deletar um setor existente", async () => {
    const response = await request(app)
      .delete(`/api/setores/del/${setorId}`)
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty(
      "message",
      "Setor e seus filhos deletados com sucesso"
    );

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

    if (redisClient) {
      await redisClient.disconnect();
    }

    // Fecha a conexão com o banco de dados de funcionários
    if (mongooseFuncionarios) {
      await mongooseFuncionarios.close();
    }

    if (mongooseUsuarios) {
      await mongooseUsuarios.close();
    }

    await mongoose.connection.close();
  });
});
