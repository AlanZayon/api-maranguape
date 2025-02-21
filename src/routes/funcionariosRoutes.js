const express = require('express');
const path = require('path');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const Funcionario = require('../models/funcionariosSchema');
const Setor = require('../models/setoresSchema');
const PDFDocument = require('pdfkit');
const s3Client = require('../config/aws');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const validateFuncionario = require('../validates/validateFuncionario');
const upload = require('../config/multerConfig');
const redisClient = require('../config/redisClient');

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

router.get('/buscarFuncionarios', async (req, res) => {
  try {
    const cacheKey = `todos:funcionarios`;

    // Tenta obter os dados do cache
    const cacheData = await redisClient.get(cacheKey);
    if (cacheData) {
      console.log('Cache hit');
      return res.json(JSON.parse(cacheData));
    }

    console.log('Cache miss');

    // Buscar todos os funcionários
    const funcionarios = await Funcionario.find();

    // Adicionar URLs para as fotos e arquivos (caso existam)
    const funcionariosComUrls = await Promise.all(
      funcionarios.map(async (funcionario) => {
        const fotoUrl = funcionario.foto
          ? await gerarUrlPreAssinada(funcionario.foto)
          : null;
        const arquivoUrl = funcionario.arquivo
          ? await gerarUrlPreAssinada(funcionario.arquivo)
          : null;

        return {
          ...funcionario.toObject(),
          fotoUrl,
          arquivoUrl,
        };
      })
    );

    // Armazena os dados no cache por 1 hora
    await redisClient.setex(
      cacheKey,
      3600,
      JSON.stringify(funcionariosComUrls)
    );

    res.json(funcionariosComUrls);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao buscar funcionários');
  }
});

// Endpoint para criação de Funcionario
router.post('/:setorId', upload, async (req, res) => {
  try {
    const { setorId } = req.params;

    if (!setorId) {
      return res.status(400).json({ error: 'setor inválida' });
    }

    // Converta redesSociais de volta para um array, se estiver presente
    if (req.body.redesSociais) {
      req.body.redesSociais = JSON.parse(req.body.redesSociais);
    }
    if (req.body.observacoes) {
      req.body.observacoes = JSON.parse(req.body.observacoes);
    }
    // Filtra itens vazios de `redesSociais` antes de validar com Joi
    if (req.body.redesSociais) {
      req.body.redesSociais = req.body.redesSociais.filter(
        (item) => item.link && item.nome
      );
    }

    if (req.body.foto === 'null') req.body.foto = null;
    if (req.body.arquivo === 'null') req.body.arquivo = null;

    const { error } = validateFuncionario.validate(req.body);
    if (error) {
      console.log('caiu aqui no 1');
      console.error(error);
      console.error(error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      nome,
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
      coordenadoria,
    } = req.body;

    // Verificar se a coordenadoria existe
    const coordenadoriaExistente = await Setor.findById(coordenadoria);
    if (
      !coordenadoriaExistente ||
      coordenadoriaExistente.tipo !== 'Coordenadoria'
    ) {
      return res.status(400).json({ error: 'Coordenadoria inválida' });
    }

    // Processar foto enviada
    let fotoUrlAWS = null;
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
      const s3UrlResponseFoto = await getSignedUrl(s3Client, command, {
        expiresIn: 60,
      });

      // Faz o upload do buffer usando a URL pré-assinada
      await axios.put(s3UrlResponseFoto, foto.buffer, {
        headers: { 'Content-Type': foto.mimetype },
      });

      fotoUrlAWS = s3Params.Key;

      const getObjectCommand = new GetObjectCommand({
        Bucket: 'system-maranguape', // Substitua pelo seu nome de bucket
        Key: fotoUrlAWS, // O caminho do arquivo no S3
      });

      const url = await getSignedUrl(s3Client, getObjectCommand, {
        expiresIn: 3600,
      });

      fotoUrl = url;
    }

    // Processar arquivo PDF enviado
    let arquivoUrlAWS = null;
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
      const s3UrlResponseArquivo = await getSignedUrl(s3Client, command, {
        expiresIn: 60,
      });

      await axios.put(s3UrlResponseArquivo, arquivo.buffer, {
        headers: { 'Content-Type': 'application/pdf' },
      });

      arquivoUrlAWS = s3Params.Key;

      const getObjectCommand = new GetObjectCommand({
        Bucket: 'system-maranguape', // Substitua pelo seu nome de bucket
        Key: arquivoUrlAWS, // O caminho do arquivo no S3
      });

      const url = await getSignedUrl(s3Client, getObjectCommand, {
        expiresIn: 3600,
      });

      arquivoUrl = url;
    }

    // Criação do funcionário com dados do corpo da requisição
    const novoFuncionario = new Funcionario({
      nome,
      foto: fotoUrlAWS,
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
      arquivo: arquivoUrlAWS,
      coordenadoria,
    });

    const funcionarioSalvo = await novoFuncionario.save();

    // Adicionar o ID do funcionário ao setor coordenadoria
    await Setor.findByIdAndUpdate(coordenadoria, {
      $push: { funcionarios: funcionarioSalvo._id },
    });

    const cacheKey = `setor:${setorId}:dados`;
    await redisClient.del(cacheKey);
    await redisClient.del('todos:funcionarios');

    res.status(201).json({
      ...funcionarioSalvo.toObject(),
      fotoUrl: funcionarioSalvo.foto ? fotoUrl : null,
      arquivoUrl: funcionarioSalvo.arquivo ? arquivoUrl : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar funcionário' });
  }
});

// Endpoint para atualizar Funcionario
router.put('/edit-funcionario/:id/:setorId?', upload, async (req, res) => {
  try {
    const { id, setorId } = req.params;

    // Verificar se o funcionário existe
    const funcionarioExistente = await Funcionario.findById(id);
    if (!funcionarioExistente) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }

    let setorFinal = setorId;

    // Se setorId for undefined, buscar o setor baseado na coordenadoria do funcionário
    if (!setorFinal) {
      if (!funcionarioExistente.coordenadoria) {
        return res.status(404).json({
          error: 'Coordenadoria não encontrada para este funcionário',
        });
      }

      // Buscar a coordenadoria do funcionário
      const coordenadoria = await Setor.findById(
        funcionarioExistente.coordenadoria
      );
      if (!coordenadoria || !coordenadoria.parent) {
        return res
          .status(404)
          .json({ error: 'Setor não encontrado para esta coordenadoria' });
      }

      setorFinal = coordenadoria.parent; // Definir setorId como o parent da coordenadoria
    }

    // Converta redesSociais e observacoes para arrays, se presentes
    if (req.body.redesSociais) {
      req.body.redesSociais = JSON.parse(req.body.redesSociais).filter(
        (item) => item.link && item.nome
      );
    }
    if (req.body.observacoes) {
      req.body.observacoes = JSON.parse(req.body.observacoes);
    }

    if (req.body.foto === 'null') req.body.foto = null;
    if (req.body.arquivo === 'null') req.body.arquivo = null;

    // Validar dados com Joi
    const { error } = validateFuncionario.validate(req.body);
    if (error) {
      console.log('caiu aq no 2');
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      nome,
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
      coordenadoria,
    } = req.body;

    // Processar nova foto, se enviada
    let fotoUrlAWS = funcionarioExistente.foto;
    let fotoUrl = null;
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
      const s3UrlResponse = await getSignedUrl(s3Client, command, {
        expiresIn: 60,
      });

      await axios.put(s3UrlResponse, foto.buffer, {
        headers: { 'Content-Type': foto.mimetype },
      });

      fotoUrlAWS = s3Params.Key;

      const getObjectCommand = new GetObjectCommand({
        Bucket: 'system-maranguape', // Substitua pelo seu nome de bucket
        Key: fotoUrlAWS, // O caminho do arquivo no S3
      });

      const url = await getSignedUrl(s3Client, getObjectCommand, {
        expiresIn: 3600,
      });

      fotoUrl = url;
    }

    // Processar novo arquivo, se enviado
    let arquivoUrl = null;
    let arquivoUrlAWS = funcionarioExistente.arquivo;
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
      const s3UrlResponse = await getSignedUrl(s3Client, command, {
        expiresIn: 60,
      });

      await axios.put(s3UrlResponse, arquivo.buffer, {
        headers: { 'Content-Type': 'application/pdf' },
      });

      arquivoUrlAWS = s3Params.Key;

      const getObjectCommand = new GetObjectCommand({
        Bucket: 'system-maranguape', // Substitua pelo seu nome de bucket
        Key: arquivoUrlAWS, // O caminho do arquivo no S3
      });

      const url = await getSignedUrl(s3Client, getObjectCommand, {
        expiresIn: 3600,
      });

      arquivoUrl = url;
    }

    // Atualizar o funcionário
    const funcionarioAtualizado = await Funcionario.findByIdAndUpdate(
      id,
      {
        nome,
        foto: fotoUrlAWS,
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

    const cacheKey = `setor:${setorFinal}:dados`;
    await redisClient.del(cacheKey);
    await redisClient.del('todos:funcionarios');

    res.status(200).json({
      ...funcionarioAtualizado.toObject(),
      fotoUrl: funcionarioAtualizado.foto ? fotoUrl : null,
      arquivoUrl: funcionarioAtualizado.arquivo ? arquivoUrl : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar funcionário' });
  }
});

// Rota para deletar os usuários
router.delete('/delete-users', async (req, res) => {
  const { userIds } = req.body; // Recebe os IDs dos usuários para deletar

  const usuariosObjectIds = userIds.map((id) =>
    mongoose.Types.ObjectId.createFromHexString(id)
  ); // Alterado para novo método

  const setoresAfetados = new Set(); // Armazena os IDs únicos dos setores afetados

  try {
    // Encontrar os usuários que serão deletados
    const usuarios = await Funcionario.find({
      _id: { $in: usuariosObjectIds },
    });

    // Para cada usuário encontrado, remova o ID do usuário do campo 'funcionarios' nos setores e coordenadorias
    for (const usuario of usuarios) {
      const coordenadoriaId = usuario.coordenadoria;

      // Também removemos o usuário do setor atual (coordenadoria do usuário)
      await Setor.updateMany(
        { _id: coordenadoriaId },
        { $pull: { funcionarios: usuario._id } }
      );

      // Busca o setor pai com base no `coordenadoriaId`
      const setor = await Setor.findOne({ _id: coordenadoriaId });

      if (setor?.parent) {
        setoresAfetados.add(setor.parent); // Adiciona o ID do setor pai ao Set
      }
    }

    // Limpa o cache de todos os setores afetados
    for (const setorId of setoresAfetados) {
      const cacheKey = `setor:${setorId}:dados`;
      await redisClient.del(cacheKey);
    }

    // Deleta os usuários do banco de dados
    await Funcionario.deleteMany({ _id: { $in: usuariosObjectIds } });

    // Limpa o cache de setores organizados
    await redisClient.del('todos:funcionarios');

    res.status(200).json({
      message:
        'Usuários deletados com sucesso e removidos de todos os setores.',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao deletar usuários' });
  }
});

router.put('/editar-coordenadoria-usuario', async (req, res) => {
  const { usuariosIds, coordenadoriaId } = req.body;

  if (!usuariosIds || !coordenadoriaId) {
    return res
      .status(400)
      .send('ID dos usuários e coordenadoria são obrigatórios.');
  }

  try {
    // Converte os IDs para ObjectId se necessário
    const usuariosObjectIds = usuariosIds.map((id) =>
      mongoose.Types.ObjectId.createFromHexString(id)
    );
    const coordenadoriaObjectId =
      mongoose.Types.ObjectId.createFromHexString(coordenadoriaId);

    const setoresAfetados = new Set(); // Armazena os setores afetados para limpar o cache posteriormente

    // Remover os usuários dos setores antigos onde eles estavam
    for (let usuarioId of usuariosObjectIds) {
      const usuario = await Funcionario.findById(usuarioId);
      if (!usuario) continue;

      // Busca a coordenadoria antiga do usuário
      const coordenadoriaAntiga = await Setor.findById(usuario.coordenadoria);

      // Se a coordenadoria antiga existir, adiciona seu setor pai ao conjunto
      if (coordenadoriaAntiga?.parent) {
        setoresAfetados.add(coordenadoriaAntiga.parent);
      }

      // Remove o funcionário diretamente da coordenadoria anterior
      await Setor.updateMany(
        { _id: usuario.coordenadoria },
        { $pull: { funcionarios: usuario._id } }
      );
    }

    // Adiciona os usuários aos setores da coordenadoria atual
    const result = await Setor.updateMany(
      { _id: coordenadoriaObjectId },
      { $addToSet: { funcionarios: { $each: usuariosObjectIds } } } // Adiciona os usuários aos setores
    );

    if (result) {
      // Atualiza os usuários com o novo ID de coordenadoria
      await Funcionario.updateMany(
        { _id: { $in: usuariosObjectIds } },
        { $set: { coordenadoria: coordenadoriaObjectId } }
      );

      // Adiciona o setor pai da nova coordenadoria ao conjunto
      const coordenadoriaAtual = await Setor.findById(coordenadoriaObjectId);
      if (coordenadoriaAtual?.parent) {
        setoresAfetados.add(coordenadoriaAtual.parent);
      }

      // Limpa o cache de todos os setores afetados
      for (const setorId of setoresAfetados) {
        const cacheKey = `setor:${setorId}:dados`;
        await redisClient.del(cacheKey);
      }

      // Limpa o cache global de setores organizados
      await redisClient.del('todos:funcionarios');

      // Retorna os usuários atualizados
      const usuariosModificados = await Funcionario.find({
        _id: { $in: usuariosObjectIds },
      });
      return res.status(200).send(usuariosModificados);
    } else {
      return res.status(404).send('Nenhum usuário encontrado ou atualizado.');
    }
  } catch (error) {
    console.error('Erro ao atualizar usuários e setores:', error);
    res.status(500).send('Erro interno no servidor');
  }
});

// Rota para deletar os usuários
router.put('/observacoes/:userId/:setorFinal', async (req, res) => {
  const { userId } = req.params;
  const { setorFinal } = req.params;
  const { observacoes } = req.body;

  try {
    const user = await Funcionario.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    user.observacoes = observacoes; // Atualizando as observações
    await user.save();

    const cacheKey = `setor:${setorFinal}:dados`;
    await redisClient.del(cacheKey);
    await redisClient.del('todos:funcionarios');
    res.status(200).json({
      message: 'Observações atualizadas com sucesso.',
      observacoes: user.observacoes,
    });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar observações.' });
  }
});

router.post('/relatorio-funcionarios/gerar', async (req, res) => {
  const { ids } = req.body;

  console.log('IDs dos funcionários: ', ids);

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Envie uma lista de IDs válida.' });
  }

  try {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 100, left: 50, right: 50, bottom: 50 },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio.pdf');

    doc.pipe(res);

    const logoPath = path.join(__dirname, '../../images/link65.png');
    const logoWidth = 150;
    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const logoX = (pageWidth - logoWidth) / 2 + doc.page.margins.left;
    doc.image(logoPath, logoX, 10, { width: 100 }).moveDown(2);

    const funcionariosSelecionados = await Funcionario.find({
      _id: { $in: ids },
    });
    const totalFuncionarios = await Funcionario.countDocuments();

    // Estilo para títulos
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#333333');

    if (funcionariosSelecionados.length === 1) {
      // Relatório Individual
      const f = funcionariosSelecionados[0];

      doc.text('Relatório Individual', { align: 'center' }).moveDown(2);
      doc
        .fontSize(14)
        .fillColor('#555555')
        .text(`Nome: ${f.nome}`)
        .text(`Secretaria: ${f.secretaria}`)
        .text(`Função: ${f.funcao}`)
        .text(`Natureza: ${f.natureza}`)
        .text(`Referência: ${f.referencia}`)
        .text(`Salário Bruto: R$ ${f.salarioBruto.toFixed(2)}`)
        .text(`Salário Líquido: R$ ${f.salarioLiquido.toFixed(2)}`)
        .text(`Endereço: ${f.endereco}`)
        .text(`Bairro: ${f.bairro}`)
        .text(`Telefone: ${f.telefone}`);
    } else {
      // Relatório Geral
      doc.text('Relatório de Funcionários', { align: 'center' }).moveDown(2);

      // Cálculo das médias salariais
      const totalSalarioBruto = funcionariosSelecionados.reduce(
        (sum, f) => sum + f.salarioBruto,
        0
      );
      const totalSalarioLiquido = funcionariosSelecionados.reduce(
        (sum, f) => sum + f.salarioLiquido,
        0
      );
      const mediaSalarioBruto =
        totalSalarioBruto / funcionariosSelecionados.length;
      const mediaSalarioLiquido =
        totalSalarioLiquido / funcionariosSelecionados.length;

      // Cálculo das referências
      const totalReferencias = {};
      funcionariosSelecionados.forEach((f) => {
        totalReferencias[f.referencia] =
          (totalReferencias[f.referencia] || 0) + 1;
      });

      // Cálculo das referências na empresa
      const referenciasEmpresa = await Funcionario.aggregate([
        { $group: { _id: '$referencia', total: { $sum: 1 } } },
      ]);

      // Cálculo dos bairros
      const totalBairros = {};
      funcionariosSelecionados.forEach((f) => {
        totalBairros[f.bairro] = (totalBairros[f.bairro] || 0) + 1;
      });

      // Relatório de referências
      doc
        .fontSize(14)
        .fillColor('#333333')
        .text('Referências', { underline: true })
        .moveDown();
      for (const [ref, qtd] of Object.entries(totalReferencias)) {
        const totalRefEmpresa =
          referenciasEmpresa.find((r) => r._id === ref)?.total || 0;
        const percentEmpresa = (
          (totalRefEmpresa / totalFuncionarios) *
          100
        ).toFixed(2);
        const percentRequisicao = (
          (qtd / funcionariosSelecionados.length) *
          100
        ).toFixed(2);
        doc
          .fontSize(12)
          .fillColor('#555555')
          .text(
            `${ref}: Total dos enviados ${qtd} (${percentRequisicao}% dos enviados, ${percentEmpresa}% da empresa)`
          );
      }
      doc.moveDown();

      // Relatório de médias salariais
      doc
        .fontSize(14)
        .fillColor('#333333')
        .text('Média Salarial', { underline: true })
        .moveDown();
      doc
        .fontSize(12)
        .fillColor('#555555')
        .text(`Média Salário Bruto: R$ ${mediaSalarioBruto.toFixed(2)}`)
        .text(`Média Salário Líquido: R$ ${mediaSalarioLiquido.toFixed(2)}`);
      doc.moveDown();

      // Relatório de bairros
      doc
        .fontSize(14)
        .fillColor('#333333')
        .text('Distribuição por Bairros', { underline: true })
        .moveDown();
      for (const [bairro, qtd] of Object.entries(totalBairros)) {
        const percentBairro = (
          (qtd / funcionariosSelecionados.length) *
          100
        ).toFixed(2);
        doc
          .fontSize(12)
          .fillColor('#555555')
          .text(`${bairro}: ${qtd} (${percentBairro}%)`);
      }
    }

    doc.end();
  } catch (err) {
    console.error('Erro ao gerar relatório:', err);
    res.status(500).send('Erro interno no servidor.');
  }
});

module.exports = router;
