const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const Funcionario = require('../models/funcionariosSchema');
const Setor = require('../models/setoresSchema');
const s3Client = require('../config/aws');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const validateFuncionario = require('../validates/validateFuncionario');
const upload = require('../config/multerConfig');
const redisClient = require("../config/redisClient"); // Importa o cliente Redis exportado no app.js


async function obterSetoresAncestrais(setorId) {
  const setoresAncestrais = [];
  let setorAtual = await Setor.findById(setorId);

  while (setorAtual && setorAtual.parent) {
    setoresAncestrais.push(setorAtual.parent);
    setorAtual = await Setor.findById(setorAtual.parent);
  }

  return setoresAncestrais;
}

// Endpoint para criação de Funcionario
router.post('/', upload, async (req, res) => {
  try {

    // Converta redesSociais de volta para um array, se estiver presente
    if (req.body.redesSociais) {
      req.body.redesSociais = JSON.parse(req.body.redesSociais);
    }
    if (req.body.observacoes) {
      req.body.observacoes = JSON.parse(req.body.observacoes);
    }
    // Filtra itens vazios de `redesSociais` antes de validar com Joi
    if (req.body.redesSociais) {
      req.body.redesSociais = req.body.redesSociais.filter(item => item.link && item.nome);
    }

    if (req.body.foto === 'null') req.body.foto = null;
    if (req.body.arquivo === 'null') req.body.arquivo = null;

    console.log(req.body.observacoes)

    const { error } = validateFuncionario.validate(req.body);
    if (error) {
      console.error(error);
      console.error(error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      nome, secretaria, funcao, natureza, referencia, redesSociais,
      salarioBruto, salarioLiquido, endereco, bairro, telefone, observacoes, coordenadoria
    } = req.body;

    // Verificar se a coordenadoria existe
    const coordenadoriaExistente = await Setor.findById(coordenadoria);
    if (!coordenadoriaExistente || coordenadoriaExistente.tipo !== 'Coordenadoria') {
      return res.status(400).json({ error: 'Coordenadoria inválida' });
    }

    // Processar foto enviada
    let fotoUrl = null;
    if (req.files && req.files.foto) {
      const foto = req.files.foto[0]; // A foto vem como um array (mesmo com um único arquivo)
      const fileName = `${Date.now()}.${foto.mimetype.split('/')[1]}`;
      const s3Params = {
        Bucket: 'system-maranguape',
        Key: `uploads/fotos/${fileName}`,
        Body: foto.buffer,
        ContentType: foto.mimetype,
        ACL: 'private',
      };

      const command = new PutObjectCommand(s3Params);
      const s3UrlResponse = await getSignedUrl(s3Client, command, { expiresIn: 60 });

      // Faz o upload do buffer usando a URL pré-assinada
      await axios.put(s3UrlResponse, foto.buffer, {
        headers: { 'Content-Type': foto.mimetype },
      });

      fotoUrl = s3Params.Key;
    }

    // Processar arquivo PDF enviado
    let arquivoUrl = null;
    if (req.files && req.files.arquivo) {
      const arquivo = req.files.arquivo[0]; // O arquivo vem como um array (mesmo com um único arquivo)
      const fileName = `${Date.now()}.pdf`;
      const s3Params = {
        Bucket: 'system-maranguape',
        Key: `uploads/arquivos/${fileName}`,
        Body: arquivo.buffer,
        ContentType: 'application/pdf',
        ACL: 'private',
      };

      const command = new PutObjectCommand(s3Params);
      const s3UrlResponse = await getSignedUrl(s3Client, command, { expiresIn: 60 });

      await axios.put(s3UrlResponse, arquivo.buffer, { headers: { 'Content-Type': 'application/pdf' } });

      arquivoUrl = s3Params.Key;
    }

    // Criação do funcionário com dados do corpo da requisição
    const novoFuncionario = new Funcionario({
      nome,
      foto: fotoUrl,
      secretaria,
      funcao,
      natureza,
      referencia,
      redesSociais,
      salarioBruto,
      salarioLiquido,
      endereco,
      bairro,
      telefone,
      observacoes,
      arquivo: arquivoUrl,
      coordenadoria
    });

    const funcionarioSalvo = await novoFuncionario.save();

    // Adicionar o ID do funcionário ao setor coordenadoria
    await Setor.findByIdAndUpdate(coordenadoria, {
      $push: { funcionarios: funcionarioSalvo._id }
    });

    // Obter e atualizar todos os setores pais com o ID do novo funcionário
    const setoresAncestrais = await obterSetoresAncestrais(coordenadoria);
    await Setor.updateMany(
      { _id: { $in: setoresAncestrais } },
      { $push: { funcionarios: funcionarioSalvo._id } }
    );

    await redisClient.del('setoresOrganizados');

    res.status(201).json(funcionarioSalvo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar funcionário' });
  }
});

// Endpoint para atualizar Funcionario
router.put('/edit-funcionario/:id', upload, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o funcionário existe
    const funcionarioExistente = await Funcionario.findById(id);
    if (!funcionarioExistente) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }

    // Converta redesSociais e observacoes para arrays, se presentes
    if (req.body.redesSociais) {
      req.body.redesSociais = JSON.parse(req.body.redesSociais).filter(item => item.link && item.nome);
    }
    if (req.body.observacoes) {
      req.body.observacoes = JSON.parse(req.body.observacoes);
    }

    if (req.body.foto === 'null') req.body.foto = null;
    if (req.body.arquivo === 'null') req.body.arquivo = null;

    // Validar dados com Joi
    const { error } = validateFuncionario.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      nome, secretaria, funcao, natureza, referencia, redesSociais,
      salarioBruto, salarioLiquido, endereco, bairro, telefone, observacoes, coordenadoria
    } = req.body;

    // Processar nova foto, se enviada
    let fotoUrl = funcionarioExistente.foto;
    if (req.files && req.files.foto) {
      const foto = req.files.foto[0];
      const fileName = `${Date.now()}.${foto.mimetype.split('/')[1]}`;
      const s3Params = {
        Bucket: 'system-maranguape',
        Key: `uploads/fotos/${fileName}`,
        Body: foto.buffer,
        ContentType: foto.mimetype,
        ACL: 'private',
      };

      const command = new PutObjectCommand(s3Params);
      const s3UrlResponse = await getSignedUrl(s3Client, command, { expiresIn: 60 });

      await axios.put(s3UrlResponse, foto.buffer, { headers: { 'Content-Type': foto.mimetype } });

      fotoUrl = s3Params.Key;
    }

    // Processar novo arquivo, se enviado
    let arquivoUrl = funcionarioExistente.arquivo;
    if (req.files && req.files.arquivo) {
      const arquivo = req.files.arquivo[0];
      const fileName = `${Date.now()}.pdf`;
      const s3Params = {
        Bucket: 'system-maranguape',
        Key: `uploads/arquivos/${fileName}`,
        Body: arquivo.buffer,
        ContentType: 'application/pdf',
        ACL: 'private',
      };

      const command = new PutObjectCommand(s3Params);
      const s3UrlResponse = await getSignedUrl(s3Client, command, { expiresIn: 60 });

      await axios.put(s3UrlResponse, arquivo.buffer, { headers: { 'Content-Type': 'application/pdf' } });

      arquivoUrl = s3Params.Key;
    }

    // Atualizar o funcionário
    const funcionarioAtualizado = await Funcionario.findByIdAndUpdate(
      id,
      {
        nome,
        foto: fotoUrl,
        secretaria,
        funcao,
        natureza,
        referencia,
        redesSociais,
        salarioBruto,
        salarioLiquido,
        endereco,
        bairro,
        telefone,
        observacoes,
        arquivo: arquivoUrl,
        coordenadoria,
      },
      { new: true } // Retorna o documento atualizado
    );

    await redisClient.del('setoresOrganizados');

    res.status(200).json(funcionarioAtualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar funcionário' });
  }
});


router.delete('/delete-users', async (req, res) => {
  const { userIds } = req.body; // Recebe os IDs dos usuários para deletar

  console.log(userIds)
  const usuariosObjectIds = userIds.map(id => mongoose.Types.ObjectId.createFromHexString(id)); // Alterado para novo método

  try {
    await Funcionario.deleteMany({ _id: { $in: usuariosObjectIds } }); // Deleta os usuários no MongoDB
    await redisClient.del('setoresOrganizados');
    res.status(200).json({ message: 'Usuários deletados com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao deletar usuários' });
  }
});

router.put('/editar-coordenadoria-usuario', async (req, res) => {
  const { usuariosIds, coordenadoriaId } = req.body;

  console.log("usuariosid: ", usuariosIds)
  console.log("coordenadoriaId: ", coordenadoriaId)

  if (!usuariosIds || !coordenadoriaId) {
    return res.status(400).send('ID dos usuários e coordenadoria são obrigatórios.');
  }

  try {

    // // Converte os IDs para ObjectId se necessário
    const usuariosObjectIds = usuariosIds.map(id => mongoose.Types.ObjectId.createFromHexString(id)); // Alterado para novo método
    const coordenadoriaObjectId = mongoose.Types.ObjectId.createFromHexString(coordenadoriaId); // Alterado para novo método
    // Atualiza todos os usuários com o novo ID de coordenadoria
    const result = await Funcionario.updateMany(
      { _id: { $in: usuariosObjectIds } },
      { $set: { coordenadoria: coordenadoriaObjectId } }
    );

    // Verifica se algum usuário foi atualizado
    if (result) {
      await redisClient.del('setoresOrganizados');
      return res.status(200).send(`Usuários atualizados com sucesso!`);
    } else {
      return res.status(404).send('Nenhum usuário encontrado ou atualizado.');
    }
  } catch (error) {
    console.error('Erro ao atualizar usuários:', error);
    res.status(500).send('Erro interno no servidor');
  }
});


module.exports = router;
