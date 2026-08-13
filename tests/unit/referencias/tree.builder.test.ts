import { Types } from 'mongoose';
import { buildTree } from '../../../src/modules/referencias/utils/tree.builder';

const oid = (label: string) => {
  const hex = Buffer.from(label.padEnd(12, '_')).toString('hex').slice(0, 24);
  return new Types.ObjectId(hex);
};

const ref = (label: string, parent: string | null = null) => ({
  _id: oid(label),
  name: label,
  parentId: parent ? oid(parent) : null,
});

const func = (label: string, parent: string) => ({
  _id: oid(label),
  nome: label,
  referenciaId: oid(parent),
});

const names = (nodes: { name: string }[]) => nodes.map((node) => node.name);

describe('buildTree', () => {
  it('monta uma cadeia de profundidade arbitrária sem código por nível', () => {
    const referencias = [
      ref('A'),
      ref('B', 'A'),
      ref('C', 'B'),
      ref('D', 'C'),
      ref('E', 'D'),
      ref('F', 'E'),
    ];

    const [raiz] = buildTree(referencias, [func('FUNC', 'F')]);

    let node = raiz;
    const caminho = [node.name];
    while (node.children.length) {
      node = node.children[0];
      caminho.push(node.name);
    }

    expect(caminho).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'FUNC']);
    expect(node.tipo).toBe('funcionario');
  });

  it('agrupa múltiplos filhos por nível, com referências antes de funcionários', () => {
    const referencias = [ref('A'), ref('B', 'A'), ref('C', 'A'), ref('D', 'A')];
    const funcionarios = [func('FUNC X', 'A')];

    const [raiz] = buildTree(referencias, funcionarios);

    expect(names(raiz.children)).toEqual(['B', 'C', 'D', 'FUNC X']);
    expect(raiz.children.map((child) => child.tipo)).toEqual([
      'referencia',
      'referencia',
      'referencia',
      'funcionario',
    ]);
  });

  it('representa a árvore completa do cenário 5', () => {
    const referencias = [
      ref('A'),
      ref('B', 'A'),
      ref('C', 'B'),
      ref('D', 'A'),
    ];
    const funcionarios = [
      func('FUNC 1', 'C'),
      func('FUNC 2', 'B'),
      func('FUNC 3', 'D'),
    ];

    const [raiz] = buildTree(referencias, funcionarios);
    const [b, d] = raiz.children;

    expect(names(raiz.children)).toEqual(['B', 'D']);
    expect(names(b.children)).toEqual(['C', 'FUNC 2']);
    expect(names(b.children[0].children)).toEqual(['FUNC 1']);
    expect(names(d.children)).toEqual(['FUNC 3']);
  });

  it('retorna múltiplas raízes quando não há um ancestral comum', () => {
    const arvore = buildTree([ref('B'), ref('C')], []);
    expect(names(arvore)).toEqual(['B', 'C']);
  });

  it('recorta a subárvore quando um rootId é informado', () => {
    const referencias = [ref('A'), ref('B', 'A'), ref('C', 'B')];
    const arvore = buildTree(referencias, [], String(oid('B')));

    expect(names(arvore)).toEqual(['B']);
    expect(names(arvore[0].children)).toEqual(['C']);
  });

  it('não entra em laço infinito se os dados contiverem um ciclo', () => {
    const referencias = [
      { _id: oid('A'), name: 'A', parentId: oid('C') },
      ref('B', 'A'),
      ref('C', 'B'),
    ];

    const arvore = buildTree(referencias, []);

    const visitados: string[] = [];
    const walk = (nodes: ReturnType<typeof buildTree>) => {
      for (const node of nodes) {
        visitados.push(node.name);
        walk(node.children);
      }
    };
    walk(arvore);

    expect(visitados.sort()).toEqual(['A', 'B', 'C']);
  });

  it('trata um nó com pai inexistente como raiz para não sumir da visualização', () => {
    const arvore = buildTree([ref('B', 'FANTASMA')], []);
    expect(names(arvore)).toEqual(['B']);
  });
});
