// Normalize leftover string ObjectId refs after Nest migration.
function toOid(v) {
  if (v == null) return null;
  if (v instanceof ObjectId) return v;
  if (typeof v === 'string' && ObjectId.isValid(v)) return ObjectId(v);
  return v;
}

let f = 0;
let s = 0;

db.funcionarios.find({}).forEach((doc) => {
  const set = {};
  if (typeof doc.tenantId === 'string') set.tenantId = toOid(doc.tenantId);
  if (typeof doc.setorId === 'string') set.setorId = toOid(doc.setorId);
  if (Object.keys(set).length) {
    db.funcionarios.updateOne({ _id: doc._id }, { $set: set });
    f++;
  }
});

db.setors.find({}).forEach((doc) => {
  const set = {};
  if (typeof doc.tenantId === 'string') set.tenantId = toOid(doc.tenantId);
  if (typeof doc.parent === 'string') set.parent = toOid(doc.parent);
  if (typeof doc.createdBy === 'string') set.createdBy = toOid(doc.createdBy);
  if (Object.keys(set).length) {
    db.setors.updateOne({ _id: doc._id }, { $set: set });
    s++;
  }
});

print('funcionarios fixed: ' + f);
print('setors fixed: ' + s);
