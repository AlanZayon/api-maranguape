const express = require("express");
const router = express.Router();
const Reference = require("../models/referenciasSchema");
const redis = require("../config/redisClient"); // Importa o cliente Redis exportado no app.js

router.post("/register-reference", async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Nome é obrigatório!" });
  }

  try {
    // Cria uma nova referência
    const newReference = new Reference({ name });
    await newReference.save();

    // Adicionar apenas a nova referência ao cache existente
    const currentCache = JSON.parse(await redis.get("referencias-dados")) || [];
    currentCache.push(newReference);
    await redis.setex("referencias-dados", 3600, JSON.stringify(currentCache));

    res.status(201).json({ message: "Referência registrada com sucesso!" });
  } catch (error) {
    console.error("Erro ao registrar referência:", error.message);

    if (error.code === 11000) {
      return res.status(400).json({ message: "Essa referência já foi registrada!" });
    }

    res.status(500).json({ message: "Erro ao registrar referência!" });
  }
});


// Rota para obter referências
router.get("/referencias-dados", async (req, res) => {
  try {
    // Verifica se os dados estão no cache Redis
    const cacheData = await redis.get("referencias-dados");

    if (cacheData) {
      console.log("Cache encontrado, enviando dados do Redis...");
      return res.json({ referencias: JSON.parse(cacheData) });
    }

    // Se não estiver no cache, busca do banco de dados
    const referencias = await Reference.find();

    // Armazena os dados no cache Redis (tempo de expiração: 1 hora)
    await redis.setex("referencias-dados", 3600, JSON.stringify(referencias));

    console.log("Dados do banco enviados e armazenados no cache.");
    res.json({ referencias });
  } catch (error) {
    console.error("Erro ao obter referências:", error.message);
    res.status(500).json({ message: "Erro ao obter referências!" });
  }
});

module.exports = router;
