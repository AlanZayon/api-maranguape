import type {
  FuncionarioNode,
  ReferenceNode,
} from '../referencias.repository';

export type TreeNode = {
  id: string;
  tipo: 'referencia' | 'funcionario';
  name: string;
  cargo?: string | null;
  telefone?: string | null;
  origem?: string | null;
  funcionarioId?: string | null;
  parentId: string | null;
  children: TreeNode[];
};

function referenceToNode(reference: ReferenceNode): TreeNode {
  return {
    id: String(reference._id),
    tipo: 'referencia',
    name: reference.name,
    cargo: reference.cargo ?? null,
    telefone: reference.telefone ?? null,
    origem: reference.origem ?? null,
    funcionarioId: reference.funcionarioId
      ? String(reference.funcionarioId)
      : null,
    parentId: reference.parentId ? String(reference.parentId) : null,
    children: [],
  };
}

function funcionarioToNode(funcionario: FuncionarioNode): TreeNode {
  return {
    id: String(funcionario._id),
    tipo: 'funcionario',
    name: funcionario.nome,
    cargo: funcionario.funcao ?? null,
    telefone: null,
    origem: funcionario.natureza ?? null,
    funcionarioId: String(funcionario._id),
    parentId: funcionario.referenciaId ? String(funcionario.referenciaId) : null,
    children: [],
  };
}

function sortChildren(node: TreeNode) {
  node.children.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === 'referencia' ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
  node.children.forEach(sortChildren);
}

/**
 * Monta a floresta de referências em um único passe. Funcionários entram sempre
 * como folhas. Nós cujo pai não existe no conjunto viram raízes, para que dados
 * inconsistentes não sumam da visualização.
 */
export function buildTree(
  referencias: ReferenceNode[],
  funcionarios: FuncionarioNode[] = [],
  rootId: string | null = null,
): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  for (const reference of referencias) {
    const node = referenceToNode(reference);
    nodes.set(node.id, node);
  }

  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  for (const funcionario of funcionarios) {
    const node = funcionarioToNode(funcionario);
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
  }

  // Um ciclo nos dados (A -> B -> A) deixaria os nós fora de `roots`; sem este
  // resgate a árvore ficaria silenciosamente incompleta.
  const reachable = new Set<string>();
  const markReachable = (node: TreeNode) => {
    if (reachable.has(node.id)) return;
    reachable.add(node.id);
    node.children.forEach(markReachable);
  };
  roots.forEach(markReachable);
  for (const node of nodes.values()) {
    if (!reachable.has(node.id)) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) {
        parent.children = parent.children.filter((child) => child !== node);
      }
      roots.push(node);
      markReachable(node);
    }
  }

  const result = rootId
    ? [nodes.get(rootId)].filter((node): node is TreeNode => Boolean(node))
    : roots;

  result.forEach(sortChildren);
  result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return result;
}

/** Cadeia raiz -> ... -> alvo, pronta para renderização linear. */
export function buildChain(
  ancestors: ReferenceNode[],
  target: TreeNode,
): TreeNode[] {
  return [...ancestors.map(referenceToNode), target];
}

export { referenceToNode, funcionarioToNode };
