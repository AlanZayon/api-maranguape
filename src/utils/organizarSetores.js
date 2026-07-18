const organizarSetores = (setores, funcionariosPorSetor, parentId = null) => {
  return setores
    .filter((setor) => String(setor.parent) === String(parentId))
    .map((setor) => {
      const obj = setor.toObject ? setor.toObject() : { ...setor };
      const id = String(obj._id);
      const children = organizarSetores(
        setores,
        funcionariosPorSetor,
        obj._id
      );
      const direct =
        funcionariosPorSetor[id] || funcionariosPorSetor[obj._id] || 0;
      const subtreeFromChildren = children.reduce(
        (sum, child) => sum + (child.quantidadeFuncionariosSubtree || 0),
        0
      );
      return {
        ...obj,
        quantidadeFuncionarios: direct,
        quantidadeFuncionariosSubtree: direct + subtreeFromChildren,
        subsetores: children,
      };
    });
};

module.exports = organizarSetores;
