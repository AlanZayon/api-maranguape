// Unset null funcionarioId on externa refs so partial unique index works cleanly.
const r = db.references.updateMany(
  { $or: [{ funcionarioId: null }, { funcionarioId: { $exists: false } }] },
  { $unset: { funcionarioId: '' } },
);
printjson(r);

try {
  db.references.dropIndex('tenantId_1_funcionarioId_1');
  print('dropped tenantId_1_funcionarioId_1');
} catch (e) {
  print('dropIndex: ' + e.message);
}

db.references.createIndex(
  { tenantId: 1, funcionarioId: 1 },
  {
    unique: true,
    name: 'tenantId_1_funcionarioId_1',
    partialFilterExpression: {
      funcionarioId: { $exists: true, $type: 'objectId' },
    },
  },
);
print('recreated partial unique index');
printjson(db.references.getIndexes());
