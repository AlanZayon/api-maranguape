const express = require('express');
const router = express.Router();
const Reference = require('../models/referenciasSchema');
const redis = require('../config/redisClient');

router.post('/register-reference', async (req, res) => {
  let { name, sobrenome, cargo, telefone } = req.body;

  // Validação: garantir que todos os campos estejam preenchidos
  if (!name || !sobrenome) {
    console.log('Erro: Campos obrigatórios não preenchidos');
    return res
      .status(400)
      .json({ message: 'Todos os campos são obrigatórios!' });
  }

  // Converter todos os campos de texto para letras maiúsculas
  name = name.toUpperCase();
  sobrenome = sobrenome.toUpperCase();
  cargo = cargo.toUpperCase();
  telefone = telefone.trim(); // Remove espaços extras do telefone

  try {
    // Verifica se já existe um registro com o mesmo nome e sobrenome
    const existingReference = await Reference.findOne({ name, sobrenome });

    if (existingReference) {
      console.log('Erro: Já existe uma referência com este nome e sobrenome');
      return res.status(400).json({
        message: 'Já existe uma referência com este nome e sobrenome!',
      });
    }

    // Criando a nova referência
    const newReference = new Reference({ name, sobrenome, cargo, telefone });
    await newReference.save();

    // Atualizando o cache do Redis
    const currentCache = JSON.parse(await redis.get('referencias-dados')) || [];
    currentCache.push(newReference);
    await redis.setex('referencias-dados', 3600, JSON.stringify(currentCache));

    res.status(201).json({ message: 'Referência registrada com sucesso!' });
  } catch (error) {
    console.error('Erro ao registrar referência:', error.message);
    res.status(500).json({ message: 'Erro ao registrar referência!' });
  }
});

// Rota para obter referências
router.get('/referencias-dados', async (req, res) => {
  try {
    // Verifica se os dados estão no cache Redis
    const cacheData = await redis.get('referencias-dados');

    if (cacheData) {
      console.log('Cache encontrado, enviando dados do Redis...');
      return res.json({ referencias: JSON.parse(cacheData) });
    }

    // Se não estiver no cache, busca do banco de dados
    const referencias = await Reference.find();

    // Armazena os dados no cache Redis (tempo de expiração: 1 hora)
    await redis.setex('referencias-dados', 3600, JSON.stringify(referencias));

    console.log('Dados do banco enviados e armazenados no cache.');
    res.json({ referencias });
  } catch (error) {
    console.error('Erro ao obter referências:', error.message);
    res.status(500).json({ message: 'Erro ao obter referências!' });
  }
});

// Rota para deletar uma referência
router.delete('/delete-referencia/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Tenta encontrar e deletar a referência no banco de dados
    const reference = await Reference.findByIdAndDelete(id);

    if (!reference) {
      return res.status(404).json({ message: 'Referência não encontrada!' });
    }

    // Atualizando o cache do Redis: removendo a referência deletada
    let currentCache = JSON.parse(await redis.get('referencias-dados')) || [];
    currentCache = currentCache.filter((ref) => ref._id.toString() !== id); // Filtra a referência deletada
    await redis.setex('referencias-dados', 3600, JSON.stringify(currentCache));

    res.status(200).json({ message: 'Referência deletada com sucesso!' });
  } catch (error) {
    console.error('Erro ao deletar referência:', error.message);
    res.status(500).json({ message: 'Erro ao deletar referência!' });
  }
});

module.exports = router;
