const User = require('../models/user');
const Task = require('../models/task');
const build = require('../utils/buildQuery');

module.exports = (router) => {
  router.get('/', async (req, res) => {
    const built = build(User, req);
    const q = built.q;
    const count = built.count;

    try {
      let data;
      if (count) {
        data = await q.countDocuments();
      } else {
        data = await q.exec();
      }
      res.status(200).json({ message: 'OK', data: data });
    } catch (err) {
      res.status(400).json({ message: 'Bad Request', data: String(err) });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const b = req.body || {};
      const newUser = await User.create({
        name: b.name,
        email: b.email,
        pendingTasks: []
      });
      res.status(201).json({ message: 'User created', data: newUser });
    } catch (err) {
      const msg = err && err.code === 11000 ? 'Email already exists' : 'Bad Request';
      res.status(400).json({ message: msg, data: String(err) });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      let selectObj = {};
      try {
        const raw = req.query.select || req.query.filter || '{}';
        selectObj = JSON.parse(raw);
      } catch (e) {
        selectObj = {};
      }

      const user = await User.findById(req.params.id).select(selectObj).exec();
      if (!user) {
        return res.status(404).json({ message: 'User not found', data: null });
      }
      res.status(200).json({ message: 'OK', data: user });
    } catch (err) {
      res.status(400).json({ message: 'Bad Request', data: String(err) });
    }
  });

  router.put('/:id', async (req, res) => {
    const b = req.body || {};

    if (!b.name || !b.email) {
      return res.status(400).json({ message: 'name and email are required', data: null });
    }

    let incoming = [];
    if (Array.isArray(b.pendingTasks)) {
      incoming = b.pendingTasks.map((x) => String(x));
    } else if (typeof b.pendingTasks === 'string') {
      try {
        const tmp = JSON.parse(b.pendingTasks);
        if (Array.isArray(tmp)) {
          incoming = tmp.map((x) => String(x));
        } else {
          incoming = [];
        }
      } catch (e) {
        incoming = b.pendingTasks
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .map((s) => String(s));
      }
    }

    try {
      const user = await User.findById(req.params.id).exec();
      if (!user) {
        return res.status(404).json({ message: 'User not found', data: null });
      }

      const oldList = (user.pendingTasks || []).map((x) => String(x));
      const nowList = incoming;

      const toUnassign = [];
      for (let i = 0; i < oldList.length; i++) {
        const id = oldList[i];
        if (nowList.indexOf(id) === -1) {
          toUnassign.push(id);
        }
      }

      const toAssign = [];
      for (let j = 0; j < nowList.length; j++) {
        const id = nowList[j];
        if (oldList.indexOf(id) === -1) {
          toAssign.push(id);
        }
      }

      if (toUnassign.length > 0) {
        await Task.updateMany(
          { _id: { $in: toUnassign }, assignedUser: String(user._id) },
          { $set: { assignedUser: '', assignedUserName: 'unassigned' } }
        ).exec();
      }

      if (toAssign.length > 0) {
        await Task.updateMany(
          { _id: { $in: toAssign } },
          { $set: { assignedUser: String(user._id), assignedUserName: b.name } }
        ).exec();
      }

      user.name = b.name;
      user.email = b.email;
      user.pendingTasks = nowList;

      const saved = await user.save();
      res.status(200).json({ message: 'User updated', data: saved });
    } catch (err) {
      const msg = err && err.code === 11000 ? 'Email already exists' : 'Bad Request';
      res.status(400).json({ message: msg, data: String(err) });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const user = await User.findById(req.params.id).exec();
      if (!user) {
        return res.status(404).json({ message: 'User not found', data: null });
      }

      if (user.pendingTasks && user.pendingTasks.length > 0) {
        await Task.updateMany(
          { _id: { $in: user.pendingTasks }, assignedUser: String(user._id) },
          { $set: { assignedUser: '', assignedUserName: 'unassigned' } }
        ).exec();
      }

      await User.deleteOne({ _id: user._id }).exec();
      res.status(204).json({ message: 'Deleted', data: null });
    } catch (err) {
      res.status(500).json({ message: 'Server Error', data: String(err) });
    }
  });

  return router;
};
