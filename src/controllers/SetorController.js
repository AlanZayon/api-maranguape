const SetorService = require('../services/SetorService');

class SetorController {
  static async createSetor(req, res) {
    try {
      const result = await SetorService.createSetor(req.body);
      res.status(201).json(result);
    } catch (error) {
      res
        .status(500)
        .json({ error: 'Erro ao criar setor', message: error.message });
    }
  }

  static async getMainSetores(req, res) {
    try {
      const setores = await SetorService.getMainSetores();
      res.json({ setores });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao buscar setores', error });
    }
  }

  static async getSetorData(req, res) {
    try {
      const { setorId } = req.params;
      const data = await SetorService.getSetorData(setorId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao buscar dados do setor', error });
    }
  }

  static async renameSetor(req, res) {
    try {
      const { id } = req.params;
      const { nome } = req.body;
      const result = await SetorService.renameSetor(id, nome);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao atualizar o setor', error });
    }
  }

  static async deleteSetor(req, res) {
    try {
      const { id } = req.params;
      await SetorService.deleteSetor(id);
      res
        .status(200)
        .json({ message: 'Setor e seus filhos deletados com sucesso' });
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Erro ao deletar o setor e seus filhos', error });
    }
  }
}

module.exports = SetorController;
