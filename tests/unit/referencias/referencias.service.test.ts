import mongoose, { Connection, Model, Types } from 'mongoose';
import {
  Reference,
  ReferenceSchema,
} from '../../../src/modules/referencias/schemas/referencia.schema';
import {
  Funcionario,
  FuncionarioSchema,
} from '../../../src/modules/funcionarios/schemas/funcionario.schema';
import { ReferenciasRepository } from '../../../src/modules/referencias/referencias.repository';
import { ReferenciasService } from '../../../src/modules/referencias/referencias.service';
import type { TreeNode } from '../../../src/modules/referencias/utils/tree.builder';

const TENANT_A = new Types.ObjectId();
const TENANT_B = new Types.ObjectId();
const SETOR_ID = new Types.ObjectId();

const cacheStub = {
  getOrSetCache: <T>(_key: string, fetchFn: () => Promise<T>) => fetchFn(),
  bumpVersion: async () => 1,
} as never;

let connection: Connection;
let referenceModel: Model<Reference>;
let funcionarioModel: Model<Funcionario>;
let repository: ReferenciasRepository;
let service: ReferenciasService;

async function criarReferencia(name: string, parent?: { _id: Types.ObjectId }) {
  return referenceModel.create({
    name,
    origem: 'externa',
    parentId: parent ? parent._id : null,
    tenantId: TENANT_A,
  });
}

async function criarFuncionario(
  nome: string,
  referencia?: { _id: Types.ObjectId; name: string },
  tenantId: Types.ObjectId = TENANT_A,
) {
  return funcionarioModel.create({
    nome,
    secretaria: 'SECRETARIA',
    funcao: 'FUNCAO',
    natureza: 'COMISSIONADO',
    salarioBruto: 1000,
    setorId: SETOR_ID,
    tenantId,
    referencia: referencia ? referencia.name : null,
    referenciaId: referencia ? referencia._id : null,
  });
}

/** Encontra um nó pelo nome percorrendo a árvore recursivamente. */
function findNode(nodes: TreeNode[], name: string): TreeNode | null {
  for (const node of nodes) {
    if (node.name === name) return node;
    const found = findNode(node.children, name);
    if (found) return found;
  }
  return null;
}

const names = (nodes: { name: string }[]) => nodes.map((node) => node.name);

beforeAll(async () => {
  connection = mongoose.createConnection(
    process.env.MONGO_CONNECTING_FUNCIONARIOS as string,
  );
  await connection.asPromise();

  referenceModel = connection.model<Reference>(Reference.name, ReferenceSchema);
  funcionarioModel = connection.model<Funcionario>(
    Funcionario.name,
    FuncionarioSchema,
  );

  repository = new ReferenciasRepository(referenceModel, funcionarioModel);
  service = new ReferenciasService(repository, cacheStub, funcionarioModel);
}, 120000);

afterAll(async () => {
  await connection?.close();
});

beforeEach(async () => {
  await Promise.all([
    referenceModel.deleteMany({}),
    funcionarioModel.deleteMany({}),
  ]);
});

describe('cadeia de ancestrais (de baixo para cima)', () => {
  it('cenário 1: funcionário indicado diretamente por uma referência', async () => {
    const a = await criarReferencia('A');
    const funcionario = await criarFuncionario('FUNCIONARIO', a);

    const { cadeia, raiz } = await service.getFuncionarioChain(
      String(funcionario._id),
      String(TENANT_A),
    );

    expect(names(cadeia)).toEqual(['A', 'FUNCIONARIO']);
    expect(raiz?.name).toBe('A');
  });

  it('cenário 2 e 3: sobe todos os níveis até a raiz, sem limite fixo', async () => {
    let parent = await criarReferencia('N0');
    const raizEsperada = parent;
    for (let i = 1; i < 8; i += 1) {
      parent = await criarReferencia(`N${i}`, parent);
    }
    const funcionario = await criarFuncionario('FUNCIONARIO', parent);

    const { cadeia, raiz } = await service.getFuncionarioChain(
      String(funcionario._id),
      String(TENANT_A),
    );

    expect(names(cadeia)).toEqual([
      'N0',
      'N1',
      'N2',
      'N3',
      'N4',
      'N5',
      'N6',
      'N7',
      'FUNCIONARIO',
    ]);
    expect(raiz?.id).toBe(String(raizEsperada._id));
  });

  it('retorna apenas o funcionário quando ele não tem indicação', async () => {
    const funcionario = await criarFuncionario('SEM REFERENCIA');

    const { cadeia, raiz } = await service.getFuncionarioChain(
      String(funcionario._id),
      String(TENANT_A),
    );

    expect(names(cadeia)).toEqual(['SEM REFERENCIA']);
    expect(raiz).toBeNull();
  });

  it('monta a cadeia de ancestrais de uma referência', async () => {
    const a = await criarReferencia('A');
    const b = await criarReferencia('B', a);
    const c = await criarReferencia('C', b);

    const { cadeia, alvo } = await service.getAncestors(
      String(c._id),
      String(TENANT_A),
    );

    expect(names(cadeia)).toEqual(['A', 'B', 'C']);
    expect(alvo.name).toBe('C');
  });

  it('não atravessa a fronteira do tenant', async () => {
    const externa = await referenceModel.create({
      name: 'OUTRO TENANT',
      origem: 'externa',
      parentId: null,
      tenantId: TENANT_B,
    });
    const filha = await referenceModel.create({
      name: 'FILHA',
      origem: 'externa',
      parentId: externa._id,
      tenantId: TENANT_A,
    });

    const { cadeia } = await service.getAncestors(
      String(filha._id),
      String(TENANT_A),
    );

    expect(names(cadeia)).toEqual(['FILHA']);
  });
});

describe('descendentes e árvore (de cima para baixo)', () => {
  it('cenário 4: lista todos os filhos diretos de uma referência', async () => {
    const a = await criarReferencia('A');
    await criarReferencia('B', a);
    await criarReferencia('C', a);
    await criarReferencia('D', a);

    const arvore = await service.getTree(String(TENANT_A));

    expect(names(arvore[0].children)).toEqual(['B', 'C', 'D']);
  });

  it('cenário 5: representa a árvore completa com referências e funcionários', async () => {
    const a = await criarReferencia('A');
    const b = await criarReferencia('B', a);
    const c = await criarReferencia('C', b);
    const d = await criarReferencia('D', a);
    await criarFuncionario('FUNCIONARIO 1', c);
    await criarFuncionario('FUNCIONARIO 2', b);
    await criarFuncionario('FUNCIONARIO 3', d);

    const arvore = await service.getTree(String(TENANT_A));

    expect(names(arvore)).toEqual(['A']);
    expect(names(arvore[0].children)).toEqual(['B', 'D']);
    expect(names(findNode(arvore, 'B')!.children)).toEqual([
      'C',
      'FUNCIONARIO 2',
    ]);
    expect(names(findNode(arvore, 'C')!.children)).toEqual(['FUNCIONARIO 1']);
    expect(names(findNode(arvore, 'D')!.children)).toEqual(['FUNCIONARIO 3']);
    expect(findNode(arvore, 'FUNCIONARIO 1')!.tipo).toBe('funcionario');
  });

  it('busca a subárvore inteira em profundidade arbitrária', async () => {
    const a = await criarReferencia('A');
    const b = await criarReferencia('B', a);
    const c = await criarReferencia('C', b);
    const d = await criarReferencia('D', c);
    await criarFuncionario('FUNCIONARIO', d);

    const { arvore } = await service.getDescendants(
      String(b._id),
      String(TENANT_A),
    );

    expect(arvore.name).toBe('B');
    expect(findNode([arvore], 'FUNCIONARIO')).not.toBeNull();
    expect(findNode([arvore], 'A')).toBeNull();
  });
});

describe('prevenção de ciclos', () => {
  it('cenário 9: impede que uma referência seja indicada por um descendente', async () => {
    const a = await criarReferencia('A');
    const b = await criarReferencia('B', a);
    const c = await criarReferencia('C', b);

    await expect(
      service.updateReference(
        String(a._id),
        { parentId: String(c._id) },
        String(TENANT_A),
      ),
    ).rejects.toThrow(/Ciclo detectado/);

    const inalterada = await referenceModel.findById(a._id);
    expect(inalterada?.parentId).toBeNull();
  });

  it('impede auto-referência', async () => {
    const a = await criarReferencia('A');

    await expect(
      service.updateReference(
        String(a._id),
        { parentId: String(a._id) },
        String(TENANT_A),
      ),
    ).rejects.toThrow(/si mesma/);
  });

  it('impede ciclo em qualquer profundidade', async () => {
    let parent = await criarReferencia('N0');
    const raiz = parent;
    for (let i = 1; i < 6; i += 1) {
      parent = await criarReferencia(`N${i}`, parent);
    }

    await expect(
      service.updateReference(
        String(raiz._id),
        { parentId: String(parent._id) },
        String(TENANT_A),
      ),
    ).rejects.toThrow(/Ciclo detectado/);
  });

  it('permite mover para um ramo que não é descendente', async () => {
    const a = await criarReferencia('A');
    const b = await criarReferencia('B', a);
    const c = await criarReferencia('C', a);

    await service.updateReference(
      String(c._id),
      { parentId: String(b._id) },
      String(TENANT_A),
    );

    const atualizada = await referenceModel.findById(c._id);
    expect(String(atualizada?.parentId)).toBe(String(b._id));
  });

  it('permite desvincular tornando a referência uma raiz', async () => {
    const a = await criarReferencia('A');
    const b = await criarReferencia('B', a);

    await service.updateReference(
      String(b._id),
      { parentId: null },
      String(TENANT_A),
    );

    const atualizada = await referenceModel.findById(b._id);
    expect(atualizada?.parentId).toBeNull();
  });
});

describe('exclusão com realocação de filhos', () => {
  it('cenário 6: filhos da referência excluída passam para o parent dela', async () => {
    const a = await criarReferencia('A');
    const b = await criarReferencia('B', a);
    const c = await criarReferencia('C', b);
    const d = await criarReferencia('D', b);

    await service.deleteReference(String(b._id), String(TENANT_A));

    expect(await referenceModel.findById(b._id)).toBeNull();
    expect(String((await referenceModel.findById(c._id))?.parentId)).toBe(
      String(a._id),
    );
    expect(String((await referenceModel.findById(d._id))?.parentId)).toBe(
      String(a._id),
    );
  });

  it('realoca também os funcionários indicados, atualizando o nome espelhado', async () => {
    const a = await criarReferencia('A');
    const b = await criarReferencia('B', a);
    const funcionario = await criarFuncionario('FUNCIONARIO X', b);

    await service.deleteReference(String(b._id), String(TENANT_A));

    const atualizado = await funcionarioModel.findById(funcionario._id);
    expect(String(atualizado?.referenciaId)).toBe(String(a._id));
    expect(atualizado?.referencia).toBe('A');
  });

  it('cenário 7: funciona em qualquer profundidade', async () => {
    const a = await criarReferencia('A');
    const b = await criarReferencia('B', a);
    const c = await criarReferencia('C', b);
    const d = await criarReferencia('D', c);
    const funcionario = await criarFuncionario('FUNCIONARIO', d);

    await service.deleteReference(String(c._id), String(TENANT_A));

    expect(String((await referenceModel.findById(d._id))?.parentId)).toBe(
      String(b._id),
    );

    const { cadeia } = await service.getFuncionarioChain(
      String(funcionario._id),
      String(TENANT_A),
    );
    expect(names(cadeia)).toEqual(['A', 'B', 'D', 'FUNCIONARIO']);
  });

  it('cenário 8: excluir a raiz transforma os filhos em raízes', async () => {
    const a = await criarReferencia('A');
    const b = await criarReferencia('B', a);
    const c = await criarReferencia('C', a);
    const funcionario = await criarFuncionario('FUNCIONARIO', a);

    await service.deleteReference(String(a._id), String(TENANT_A));

    expect((await referenceModel.findById(b._id))?.parentId).toBeNull();
    expect((await referenceModel.findById(c._id))?.parentId).toBeNull();
    expect(await referenceModel.countDocuments({})).toBe(2);

    const orfao = await funcionarioModel.findById(funcionario._id);
    expect(orfao?.referenciaId).toBeNull();
    expect(orfao?.referencia).toBeNull();

    const arvore = await service.getTree(String(TENANT_A));
    expect(names(arvore)).toEqual(['B', 'C']);
  });

  it('mantém a árvore navegável após exclusões sucessivas', async () => {
    const a = await criarReferencia('A');
    const b = await criarReferencia('B', a);
    const c = await criarReferencia('C', b);
    const d = await criarReferencia('D', c);
    const funcionario = await criarFuncionario('FUNCIONARIO', d);

    await service.deleteReference(String(c._id), String(TENANT_A));
    await service.deleteReference(String(b._id), String(TENANT_A));

    const { cadeia } = await service.getFuncionarioChain(
      String(funcionario._id),
      String(TENANT_A),
    );
    expect(names(cadeia)).toEqual(['A', 'D', 'FUNCIONARIO']);

    const orfaos = await referenceModel.countDocuments({
      parentId: { $nin: [null, a._id, d._id] },
    });
    expect(orfaos).toBe(0);
  });

  it('não exclui referência de outro tenant', async () => {
    const outra = await referenceModel.create({
      name: 'OUTRO TENANT',
      origem: 'externa',
      parentId: null,
      tenantId: TENANT_B,
    });

    await expect(
      service.deleteReference(String(outra._id), String(TENANT_A)),
    ).rejects.toThrow(/não encontrada/);
    expect(await referenceModel.findById(outra._id)).not.toBeNull();
  });

  it('informa o impacto da exclusão antes de confirmar', async () => {
    const a = await criarReferencia('A');
    const b = await criarReferencia('B', a);
    await criarReferencia('C', b);
    await criarFuncionario('FUNCIONARIO', b);

    const impacto = await service.getDeletionImpact(
      String(b._id),
      String(TENANT_A),
    );

    expect(impacto.novoParent?.name).toBe('A');
    expect(impacto.filhos).toEqual({ referencias: 1, funcionarios: 1 });
  });
});

describe('cadastro e renomeação', () => {
  it('cria uma referência já vinculada a uma indicadora', async () => {
    const a = await criarReferencia('A');

    const criada = await service.registerExterna(
      { name: 'nova referencia', parentId: String(a._id) },
      String(TENANT_A),
    );

    expect(criada.name).toBe('NOVA REFERENCIA');
    expect(String(criada.parentId)).toBe(String(a._id));
  });

  it('rejeita indicadora inexistente', async () => {
    await expect(
      service.registerExterna(
        { name: 'NOVA', parentId: String(new Types.ObjectId()) },
        String(TENANT_A),
      ),
    ).rejects.toThrow(/não encontrada/);
  });

  it('propaga o novo nome para os funcionários indicados', async () => {
    const a = await criarReferencia('A');
    const funcionario = await criarFuncionario('FUNCIONARIO', a);

    await service.updateReference(
      String(a._id),
      { name: 'a renomeada' },
      String(TENANT_A),
    );

    const atualizado = await funcionarioModel.findById(funcionario._id);
    expect(atualizado?.referencia).toBe('A RENOMEADA');
  });

  it('rejeita renomear para um nome já existente no tenant', async () => {
    await criarReferencia('A');
    const b = await criarReferencia('B');

    await expect(
      service.updateReference(String(b._id), { name: 'A' }, String(TENANT_A)),
    ).rejects.toThrow(/Já existe/);
  });
});
