const path = require('path');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const dbFuncionarios = require('../config/Mongoose/funcionariosConnection');
const Setor = require('../models/setoresSchema');

describe('GET /dados', () => {
    // Limpa o banco de dados após cada teste
    afterEach(async () => {
        await Setor.deleteMany({});
    });

    // Fecha a conexão com o MongoDB após todos os testes
    afterAll(async () => {
        await dbFuncionarios.close();
        await mongoose.disconnect();

    });
    it('deve retornar setores, subsetores e coordenadorias organizados', async () => {
        // Criando setores para testar
        const setorPrincipal = new Setor({
            nome: 'Setor A',
            tipo: 'Setor',
            parent: null,
        });

        const subsetorA = new Setor({
            nome: 'Subsetor A',
            tipo: 'Subsetor',
            parent: setorPrincipal._id,
        });

        const coordenadoriaA1 = new Setor({
            nome: 'Coordenadoria A1',
            tipo: 'Coordenadoria',
            parent: subsetorA._id,
        });

        await setorPrincipal.save();
        await subsetorA.save();
        await coordenadoriaA1.save();

        // Fazendo a requisição para a rota /dados
        const response = await request(app).get('/api/setores/dados');

        // Verificando o status HTTP
        expect(response.status).toBe(200);

        // Verificando a estrutura da resposta
        expect(response.body.setores).toHaveLength(1);
        expect(response.body.setores[0].nome).toBe('Setor A');
        expect(response.body.setores[0].tipo).toBe('Setor');
        expect(response.body.setores[0].subsetores).toHaveLength(1);
        expect(response.body.setores[0].subsetores[0].nome).toBe('Subsetor A');
        expect(response.body.setores[0].subsetores[0].tipo).toBe('Subsetor');
        expect(response.body.setores[0].subsetores[0].coordenadorias).toHaveLength(1);
        expect(response.body.setores[0].subsetores[0].coordenadorias[0].nome).toBe('Coordenadoria A1');
    });

});