const rootId = ObjectId('6a5b7ebfb56cf69af7f3ae72');
const tid = ObjectId('6a5b7c0e346d46c6d2fe09b6');

print('--- children by ObjectId parent ---');
printjson(
  db.setors
    .find({ parent: rootId }, { nome: 1, parent: 1, tenantId: 1 })
    .toArray()
    .map((s) => ({
      nome: s.nome,
      parentType: typeof s.parent,
      parent: String(s.parent),
      tenantType: typeof s.tenantId,
    })),
);

print('--- children by string parent ---');
printjson(
  db.setors
    .find({ parent: String(rootId) }, { nome: 1, parent: 1 })
    .toArray()
    .map((s) => ({ nome: s.nome, parent: s.parent })),
);

print('--- graphLookup ObjectId start ---');
const g1 = db.setors.aggregate([
  { $match: { _id: rootId } },
  {
    $graphLookup: {
      from: 'setors',
      startWith: '$_id',
      connectFromField: '_id',
      connectToField: 'parent',
      as: 'descendants',
    },
  },
  {
    $project: {
      nome: 1,
      desc: {
        $map: {
          input: '$descendants',
          as: 'd',
          in: '$$d.nome',
        },
      },
      ids: '$descendants._id',
    },
  },
]);
printjson(g1.toArray());

print('--- funcionarios in MULHER ---');
const mulher = db.setors.findOne({ nome: 'MULHER' });
if (mulher) {
  print(
    'mulher id=' +
      mulher._id +
      ' parent=' +
      mulher.parent +
      ' parentType=' +
      typeof mulher.parent,
  );
  print(
    'funcs by oid: ' +
      db.funcionarios.countDocuments({ setorId: mulher._id }),
  );
  print(
    'funcs by string: ' +
      db.funcionarios.countDocuments({ setorId: String(mulher._id) }),
  );
}

print('--- all parent types ---');
db.setors.find({}, { nome: 1, parent: 1 }).forEach((s) => {
  print(
    s.nome +
      ' parent=' +
      s.parent +
      ' type=' +
      (s.parent === null ? 'null' : s.parent instanceof ObjectId ? 'ObjectId' : typeof s.parent),
  );
});
