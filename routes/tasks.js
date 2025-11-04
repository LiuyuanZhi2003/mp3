const Task = require('../models/task');
const User = require('../models/user');
const build = require('../utils/buildQuery');

module.exports = (router) => {
  router.get('/', async (req, res) => {
    if (req.query.limit == null) {
      req.query.limit = '100';
    }

    const built = build(Task, req);
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

      let completed = false;
      if (b.completed === true) completed = true;
      if (typeof b.completed === 'string' && b.completed.toLowerCase() === 'true') {
        completed = true;
      }

      let deadline;
      if (b.deadline) {
        deadline = new Date((+b.deadline) || b.deadline);
      }

      const uid = b.assignedUser || '';

      const t = new Task({
        name: b.name,
        description: b.description || '',
        deadline: deadline,
        completed: completed,
        assignedUser: uid,
        assignedUserName: uid ? '' : 'unassigned'
      });

      await t.validate();

      if (uid) {
        const u = await User.findById(uid).exec();
        if (!u) {
          return res.status(400).json({ message: 'assignedUser not found', data: null });
        }

        t.assignedUserName = u.name;
        const created = await t.save();

        const tid = String(created._id);
        if (!created.completed) {
          const already = u.pendingTasks && u.pendingTasks.indexOf(tid) !== -1;
          if (!already) {
            u.pendingTasks.push(tid);
            await u.save();
          }
        }

        return res.status(201).json({ message: 'Task created', data: created });
      } else {
        const created = await t.save();
        return res.status(201).json({ message: 'Task created', data: created });
      }
    } catch (err) {
      res.status(400).json({ message: 'Bad Request', data: String(err) });
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

      const t = await Task.findById(req.params.id).select(selectObj).exec();
      if (!t) {
        return res.status(404).json({ message: 'Task not found', data: null });
      }
      res.status(200).json({ message: 'OK', data: t });
    } catch (err) {
      res.status(400).json({ message: 'Bad Request', data: String(err) });
    }
  });

  router.put('/:id', async (req, res) => {
    const b = req.body || {};
    if (!b.name || !b.deadline) {
      return res.status(400).json({ message: 'name and deadline are required', data: null });
    }

    let completed = false;
    if (b.completed === true) completed = true;
    if (typeof b.completed === 'string' && b.completed.toLowerCase() === 'true') {
      completed = true;
    }

    let deadline;
    if (b.deadline) {
      deadline = new Date((+b.deadline) || b.deadline);
    }

    const nextUser = b.assignedUser || '';

    try {
      const t = await Task.findById(req.params.id).exec();
      if (!t) {
        return res.status(404).json({ message: 'Task not found', data: null });
      }

      const prevUser = t.assignedUser || '';

      t.name = b.name;
      t.description = b.description || '';
      t.deadline = deadline;
      t.completed = completed;
      t.assignedUser = nextUser;
      t.assignedUserName = nextUser ? t.assignedUserName : 'unassigned';

      if (nextUser) {
        const u = await User.findById(nextUser).exec();
        if (!u) {
          return res.status(400).json({ message: 'assignedUser not found', data: null });
        }

        t.assignedUserName = u.name;

        const tid = String(t._id);
        const has = u.pendingTasks && u.pendingTasks.indexOf(tid) !== -1;
        if (!t.completed && !has) {
          u.pendingTasks.push(tid);
          await u.save();
        }
      }

      if (prevUser && prevUser !== nextUser) {
        await User.updateOne(
          { _id: prevUser },
          { $pull: { pendingTasks: String(t._id) } }
        ).exec();
      }

      if (t.completed && nextUser) {
        await User.updateOne(
          { _id: nextUser },
          { $pull: { pendingTasks: String(t._id) } }
        ).exec();
      }

      const saved = await t.save();
      res.status(200).json({ message: 'Task updated', data: saved });
    } catch (err) {
      res.status(400).json({ message: 'Bad Request', data: String(err) });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const t = await Task.findById(req.params.id).exec();
      if (!t) {
        return res.status(404).json({ message: 'Task not found', data: null });
      }

      if (t.assignedUser) {
        await User.updateOne(
          { _id: t.assignedUser },
          { $pull: { pendingTasks: String(t._id) } }
        ).exec();
      }

      await Task.deleteOne({ _id: t._id }).exec();
      res.status(204).json({ message: 'Deleted', data: null });
    } catch (err) {
      res.status(500).json({ message: 'Server Error', data: String(err) });
    }
  });

  return router;
};
