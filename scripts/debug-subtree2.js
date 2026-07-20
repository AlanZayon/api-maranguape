const rootId = ObjectId('6a5b7ebfb56cf69af7f3ae72');
const tid = ObjectId('6a5b7c0e346d46c6d2fe09b6');

print('--- root doc ---');
printjson(db.setors.findOne({ _id: rootId }));

print('--- match with tenant $in ---');
print(
  'count: ' +
    db.setors.countDocuments({
      _id: rootId,
      tenantId: { $in: [tid, String(tid)] },
    }),
);

print('--- all funcionarios ---');
db.funcionarios.find({}, { nome: 1, setorId: 1, tenantId: 1 }).forEach((f) => {
  print(
    f.nome +
      ' setorId=' +
      f.setorId +
      ' setorType=' +
      (f.setorId instanceof ObjectId ? 'ObjectId' : typeof f.setorId) +
      ' tenantType=' +
      (f.tenantId instanceof ObjectId ? 'ObjectId' : typeof f.tenantId),
  );
});

print('--- simulate descendant ids + count funcs ---');
const rows = db.setors
  .aggregate([
    { $match: { _id: rootId, tenantId: { $in: [tid, String(tid)] } } },
    {
      $graphLookup: {
        from: 'setors',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parent',
        as: 'hierarquia',
      },
    },
    {
      $graphLookup: {
        from: 'setors',
        startWith: { $toString: '$_id' },
        connectFromField: '_id',
        connectToField: 'parent',
        as: 'hierarquiaStr',
      },
    },
    {
      $project: {
        allIds: {
          $setUnion: [['$_id'], '$hierarquia._id', '$hierarquiaStr._id'],
        },
      },
    },
  ])
  .toArray();

printjson(rows);
const ids = rows[0] ? rows[0].allIds : [];
print('ids count: ' + ids.length);
print(
  'funcs in subtree oid-only: ' +
    db.funcionarios.countDocuments({ setorId: { $in: ids } }),
);

// expand string forms like toMatchIds
const expanded = [];
ids.forEach((id) => {
  expanded.push(id);
  expanded.push(String(id));
});
print(
  'funcs in subtree expanded: ' +
    db.funcionarios.countDocuments({ setorId: { $in: expanded } }),
);

print('--- where are the 844-byte funcs? ---');
const t1 = ObjectId('6a5e8b72b71e53bbe118897b');
printjson(db.setors.findOne({ _id: t1 }, { nome: 1, parent: 1 }));
print(
  'funcs on TESTE1 node: ' + db.funcionarios.countDocuments({ setorId: t1 }),
);
print(
  'funcs on TESTE1 string: ' +
    db.funcionarios.countDocuments({ setorId: String(t1) }),
);
