const AuthService = require('../services/authService');

const isProduction = process.env.NODE_ENV === 'production';

const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
};

class AuthController {
  static async login(req, res, next) {
    const { id, password } = req.body;
    const tokenLogin = req.cookies.authToken;

    try {
      const { token, user } = await AuthService.login(
        id,
        password,
        tokenLogin,
        req.tenantId || null
      );

      res.cookie('authToken', token, {
        ...authCookieOptions,
        maxAge: AuthService.getCookieMaxAge(),
      });

      res.json(user);
    } catch (err) {
      next(err);
    }
  }

  static async logout(req, res, next) {
    const token = req.cookies.authToken;

    try {
      await AuthService.logout(token);
      res.clearCookie('authToken', authCookieOptions);
      res.status(200).json({ message: 'Logout realizado com sucesso!' });
    } catch (err) {
      next(err);
    }
  }

  static verify(req, res) {
    const token = req.cookies.authToken;
    const result = AuthService.verifyToken(token);
    res.status(result.authenticated ? 200 : 401).json(result);
  }
}

module.exports = AuthController;
