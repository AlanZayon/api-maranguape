const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const {
  authenticate,
  authorize,
  USERS_MANAGERS,
} = require('../middlewares/auth');
const UserController = require('../controllers/userController');

router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/verify', AuthController.verify);

router.get(
  '/manage',
  authenticate,
  authorize(...USERS_MANAGERS),
  UserController.list
);
router.post(
  '/manage',
  authenticate,
  authorize(...USERS_MANAGERS),
  UserController.create
);
router.put(
  '/manage/:id',
  authenticate,
  authorize(...USERS_MANAGERS),
  UserController.update
);
router.delete(
  '/manage/:id',
  authenticate,
  authorize(...USERS_MANAGERS),
  UserController.remove
);

module.exports = router;
