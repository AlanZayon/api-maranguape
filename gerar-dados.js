// gerar-dados.js
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');

mongoose.connect(
  'mongodb+srv://Maranguape_System:l4PRnxl3D0r0Oh2O@cluster0.ulmlh1b.mongodb.net/Funcionarios?retryWrites=true&w=majority&appName=Cluster0'
);

// Seu schema (ajuste conforme necessário)
const funcionarioSchema = new mongoose.Schema({
  nome: String,
  foto: String,
  secretaria: String,
  funcao: String,
  tipo: String,
  natureza: String,
  referencia: String,
  redesSociais: [String],
  salarioBruto: Number,
  endereco: String,
  bairro: String,
  telefone: String,
  observacoes: [String],
  arquivo: String,
  coordenadoria: mongoose.Schema.Types.ObjectId,
  createdAt: Date,
  __v: Number,
  cidade: String,
});

const Funcionario = mongoose.model('Funcionario', funcionarioSchema);

// Geração de dados
async function gerarDados(qtd = 10000) {
  const lista = [];

  for (let i = 0; i < qtd; i++) {
    lista.push({
      nome: faker.person.fullName(),
      foto: null,
      secretaria: faker.helpers.arrayElement([
        'GABINETE',
        'FINANÇAS',
        'SAÚDE',
        'EDUCAÇÃO',
      ]),
      funcao: faker.helpers.arrayElement([
        'AUXILIAR TECNICO',
        'ANALISTA',
        'COORDENADOR',
      ]),
      tipo: faker.helpers.arrayElement([
        'EXECUCAO INSTRUMENTAL',
        'ADMINISTRATIVO',
      ]),
      natureza: faker.helpers.arrayElement(['COMISSIONADO', 'EFETIVO']),
      referencia: faker.person.firstName(),
      redesSociais: [],
      salarioBruto: faker.number.int({ min: 1200, max: 10000 }),
      endereco: faker.location.street(),
      bairro: faker.location.city(),
      telefone: faker.phone.number('###########'),
      observacoes: [],
      arquivo: null,
      coordenadoria: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
      __v: 0,
      cidade: 'FORTALEZA',
    });
  }

  await Funcionario.insertMany(lista);
  console.log(`${qtd} documentos inseridos com sucesso!`);
  mongoose.disconnect();
}

gerarDados();
