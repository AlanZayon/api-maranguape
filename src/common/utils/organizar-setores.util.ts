export type FuncionariosPorSetor = Record<string, number>;

export type SetorLike = {
  _id: unknown;
  parent?: unknown;
  toObject?: () => Record<string, unknown>;
};

export type SetorOrganizado = Record<string, unknown> & {
  quantidadeFuncionarios: number;
  quantidadeFuncionariosSubtree: number;
  subsetores: SetorOrganizado[];
};

/** Normalize parent refs so null/undefined/'' all match as roots. */
function parentKey(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value);
}

/**
 * Builds a nested tree of setores/subsetores starting at `parentId`,
 * annotating each node with direct and subtree employee counts.
 */
export function organizarSetores(
  setores: SetorLike[],
  funcionariosPorSetor: FuncionariosPorSetor,
  parentId: unknown = null,
): SetorOrganizado[] {
  const target = parentKey(parentId);
  return setores
    .filter((setor) => parentKey(setor.parent) === target)
    .map((setor) => {
      const obj = setor.toObject ? setor.toObject() : { ...setor };
      const id = String((obj as { _id: unknown })._id);
      const children = organizarSetores(
        setores,
        funcionariosPorSetor,
        (obj as { _id: unknown })._id,
      );
      const direct =
        funcionariosPorSetor[id] ||
        funcionariosPorSetor[String((obj as { _id: unknown })._id)] ||
        0;
      const subtreeFromChildren = children.reduce(
        (sum, child) => sum + (child.quantidadeFuncionariosSubtree || 0),
        0,
      );
      return {
        ...obj,
        quantidadeFuncionarios: direct,
        quantidadeFuncionariosSubtree: direct + subtreeFromChildren,
        subsetores: children,
      };
    });
}
