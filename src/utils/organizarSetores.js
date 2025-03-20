const organizarSetores = (setores, parentId = null) => {
  return setores
    .filter((setor) => String(setor.parent) === String(parentId))
    .map((setor) => ({
      ...setor.toObject(),
      subsetores: organizarSetores(setores, setor._id).filter(
        (s) => s.tipo === 'Subsetor'
      ),
      coordenadorias: organizarSetores(setores, setor._id).filter(
        (s) => s.tipo === 'Coordenadoria'
      ),
    }));
};

module.exports = organizarSetores;
