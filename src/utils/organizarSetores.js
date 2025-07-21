const organizarSetores = (setores, funcionariosPorSetor, parentId = null) => {
  return setores
    .filter((setor) => String(setor.parent) === String(parentId))
    .map((setor) => ({
      ...setor.toObject(),
      subsetores: organizarSetores(setores, funcionariosPorSetor, setor._id).filter(
        (s) => s.tipo === 'Subsetor'
      ),
      coordenadorias: organizarSetores(setores, funcionariosPorSetor, setor._id)
        .filter((s) => s.tipo === 'Coordenadoria')
        .map(coordenadoria => ({
          ...coordenadoria,
          quantidadeFuncionarios: funcionariosPorSetor[coordenadoria._id] || 0
        }))
    }));
};

module.exports = organizarSetores;