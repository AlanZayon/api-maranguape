const AuthService = require('../services/authService');

class AuthController {
  static async login(req, res) {
    const { id, password } = req.body;
    const tokenLogin = req.cookies.authToken;

    try {
      const { token, user } = await AuthService.login(id, password, tokenLogin);

      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });

      res.json(user);
    } catch (err) {
      res.status(401).json({ message: err.message });
    }
  }

  static async logout(req, res) {
    const token = req.cookies.authToken;

    try {
      await AuthService.logout(token);

      res.clearCookie('authToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      });
      res.status(200).json({ message: 'Logout realizado com sucesso!' });
    } catch (err) {
      res.status(500).json({ message: 'Erro no logout', error: err.message });
    }
  }

  static verify(req, res) {
    const token = req.cookies.authToken;
    const result = AuthService.verifyToken(token);
    res.status(result.authenticated ? 200 : 401).json(result);
  }
}

module.exports = AuthController;