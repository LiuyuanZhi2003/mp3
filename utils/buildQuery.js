function j(v, fb) {
  if (v == null) return fb;
  try {
    return JSON.parse(v);
  } catch (e) {
    return fb;
  }
}

module.exports = (Model, req) => {
  const where = j(req.query.where, {});
  let selectObj = j(req.query.select, undefined);
  if (selectObj === undefined) {
    selectObj = j(req.query.filter, {});
  }
  const sortObj = j(req.query.sort, {});

  let skip;
  let limit;

  const rawSkip = +req.query.skip;
  if (Number.isFinite(rawSkip)) {
    skip = rawSkip;
  } else {
    skip = undefined;
  }

  const rawLimit = +req.query.limit;
  if (Number.isFinite(rawLimit)) {
    limit = rawLimit;
  } else {
    limit = undefined;
  }

  const count = String(req.query.count).toLowerCase() === 'true';
  let q = Model.find(where).select(selectObj).sort(sortObj);

  if (skip != null) {
    q = q.skip(skip);
  }
  if (limit != null) {
    q = q.limit(limit);
  }

  return { q: q, count: count };
};
