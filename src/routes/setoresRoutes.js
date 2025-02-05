const express = require('express');
const router = express.Router();
const Setor = require('../models/setoresSchema');
const Funcionario = require('../models/funcionariosSchema');
const validateSetor = require('../validates/validatesSetor');
const s3Client = require('../config/aws');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } =require('@aws-sdk/s3-request-presigner');
const redisClient = require("../config/redisClient"); // Importa o cliente Redis exportado no app.js


const gerarUrlPreAssinada = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: 'system-maranguape', // Substitua pelo seu nome de bucket
      Key: key, // O caminho do arquivo no S3
    });
    // Gera a URL pré-assinada com 1 hora de validade (3600 segundos)
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return url;
  } catch (error) {
    console.error('Erro ao gerar URL pré-assinada:', error);
    return null;
  }
};

// Endpoint para criação de Setor, Subsetor ou Coordenadoria
router.post('/', async (req, res) => {
  try {
    const { error } = validateSetor(req.body); // Valida os dados da requisição
    if (error) {
      // Retorna erros de validação para o cliente
      return res.status(400).json({ error: 'Erro de validação', details: error.details.map(detail => detail.message) });
    }

    const { nome, tipo, parent } = req.body;

    // Criação do setor com dados do corpo da requisição
    const novoSetor = new Setor({ nome, tipo, parent });
    const setorSalvo = await novoSetor.save();

    await redisClient.del('setoresOrganizados');
    await redisClient.del('setores:null');
    await redisClient.del(`setor:${parent}:dados`); // Remove o cache do setor pai
    await redisClient.del(`setor:${setorSalvo._id}:dados`); // Remove o cache do novo setor


    res.status(201).json(setorSalvo);
  } catch (error) {
    console.error('Erro ao criar setor:', error); // Log do erro
    res.status(500).json({ error: 'Erro ao criar setor', message: error.message });
  }
});

// Rota para buscar todos os setores, subsetores e coordenadorias organizados
router.get('/setoresOrganizados', async (req, res) => {
  try {

    const cacheKey = 'setoresOrganizados';
    const cacheData = await redisClient.get(cacheKey);

    if (cacheData) {
      console.log('Cache hit');
      return res.json({ setores: JSON.parse(cacheData) });
    }

    console.log('Cache miss');
    const setores = await Setor.find();
  
    const organizarSetores = async (parentId = null) => {
      const setoresFiltrados = setores.filter(setor => String(setor.parent) === String(parentId));
  
      return await Promise.all(setoresFiltrados.map(async (setor) => {
        const subsetoresOrganizados = await organizarSetores(setor._id);
        const subsetores = subsetoresOrganizados.filter(subsetor => subsetor.tipo === 'Subsetor');
        const coordenadorias = subsetoresOrganizados.filter(coordenadoria => coordenadoria.tipo === 'Coordenadoria');
  
        return {
          ...setor.toObject(),
          subsetores: subsetores.length > 0 ? subsetores : [],
          coordenadorias: coordenadorias.length > 0 ? coordenadorias : []
        };
      }));
    };
  
    const setoresOrganizados = await organizarSetores();
    await redisClient.setex(cacheKey, 3600, JSON.stringify(setoresOrganizados));
    res.json({ setores: setoresOrganizados });
  
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao buscar dados');
  }  
});


router.get('/setoresMain', async (req, res) => {
  try {
    const cacheKey = 'setores:null'; // A chave do cache será fixa, já que o parent é sempre null

    // Tenta obter os dados do cache
    const cacheData = await redisClient.get(cacheKey);

    if (cacheData) {
      console.log('Cache hit');
      return res.json({ setores: JSON.parse(cacheData) });
    }

    console.log('Cache miss');
    
    // Busca os setores principais (onde o 'parent' é null)
    const setores = await Setor.find({ parent: null });

    // Armazena os dados no cache por 1 hora
    await redisClient.setex(cacheKey, 3600, JSON.stringify(setores));

    res.json({ setores });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao buscar setores');
  }
});

router.get('/dados/:setorId', async (req, res) => {
  try {
    const { setorId } = req.params;
    console.log(setorId)
    const cacheKey = `setor:${setorId}:dados`;

    // Tenta obter os dados do cache
    const cacheData = await redisClient.get(cacheKey);

    if (cacheData) {
      console.log(cacheData,'Cache hit');
      return res.json(JSON.parse(cacheData));
    }

    console.log('Cache miss');

    // Buscar os subsetores e coordenadorias com base no parent (ID do setor)
    const subsetores = await Setor.find({ parent: setorId, tipo: 'Subsetor' });
    const coordenadorias = await Setor.find({ parent: setorId, tipo: 'Coordenadoria' });

    console.log(subsetores)

    // Buscar funcionários para as coordenadorias (caso necessário)
    const funcionarios = await Funcionario.find();
    const coordenadoriasComFuncionarios = await Promise.all(coordenadorias.map(async (coordenadoria) => {
      const funcionariosDaCoordenadoria = funcionarios.filter(
        funcionario => String(funcionario.coordenadoria) === String(coordenadoria._id)
      );
  
      const funcionariosComUrls = await Promise.all(funcionariosDaCoordenadoria.map(async (funcionario) => {
        const fotoUrl = funcionario.foto ? await gerarUrlPreAssinada(funcionario.foto) : null;
        const arquivoUrl = funcionario.arquivo ? await gerarUrlPreAssinada(funcionario.arquivo) : null;
  
        return {
          ...funcionario.toObject(), // Certifique-se de que 'funcionario' é um documento Mongoose
          fotoUrl: fotoUrl,
          arquivoUrl: arquivoUrl
        };
      }));
  
      return {
        ...coordenadoria.toObject(),
        funcionarios: funcionariosComUrls.length > 0 ? funcionariosComUrls : []
      };
    }));

    const dados = {
      subsetores,
      coordenadoriasComFuncionarios,
    };

    // Armazena os dados no cache por 1 hora
    await redisClient.setex(cacheKey, 3600, JSON.stringify(dados));

    res.json(dados);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao buscar dados do setor');
  }
});


// Rota para atualizar o nome do setor
router.put('/rename/:id', async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;

  try {
    // Encontra o setor pelo ID e atualiza o nome
    const setor = await Setor.findById(id);
    
    if (!setor) {
      return res.status(404).json({ message: 'Setor não encontrado' });
    }

    setor.nome = nome; // Atualiza o nome
    await setor.save(); // Salva o setor atualizado

    const cacheKey = `setor:${setor.parent}:dados`;
    await redisClient.del(cacheKey);
    await redisClient.del('setores:null');
    await redisClient.del('setoresOrganizados');

    return res.status(200).json(setor); // Retorna o setor atualizado
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar o setor' });
  }
});

// Rota para deletar um setor e seus filhos (subsetores e coordenadorias)
router.delete('/del/:id', async (req, res) => {
  const { id } = req.params;
  console.log(id);

  try {
    // Função recursiva para deletar todos os filhos
    const deleteAllChildren = async (setorId) => {
      // Encontra todos os filhos do setor
      const filhos = await Setor.find({ parent: setorId });

      // Para cada filho, deletamos recursivamente seus filhos e o próprio
      for (const filho of filhos) {
        await deleteAllChildren(filho._id); // Deleta os filhos desse filho
        await Setor.findByIdAndDelete(filho._id); // Deleta o filho
      }
    };

    // Encontra o setor principal pelo ID
    const setor = await Setor.findById(id);
    
    if (!setor) {
      console.log('Setor não encontrado')
      return res.status(404).json({ message: 'Setor não encontrado' });
    }

    // Deleta todos os filhos do setor de forma recursiva
    await deleteAllChildren(id);

    // Deleta o setor principal
    await Setor.findByIdAndDelete(id);

    // Remover o cache relacionado ao setor deletado e seus filhos
    await redisClient.del(`setor:${setor.parent}:dados`);
    await redisClient.del('setores:null');
    await redisClient.del('setoresOrganizados');
    
    return res.status(200).json({ message: 'Setor e seus filhos deletados com sucesso' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao deletar o setor e seus filhos' });
  }
});



module.exports = router;
