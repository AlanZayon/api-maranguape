const UserService = require('../services/userService');

class UserController {
  static async list(req, res, next) {
    try {
      const users = await UserService.list(req.user);
      res.json({ users });
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const user = await UserService.create(req.user, req.body);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const user = await UserService.update(req.user, req.params.id, req.body);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }

  static async remove(req, res, next) {
    try {
      const result = await UserService.remove(req.user, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = UserController;
