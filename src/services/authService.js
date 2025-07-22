const jwt = require('jsonwebtoken');
const AuthRepository = require('../repositories/authRepository');

class AuthService {
  static async login(id, password, tokenLogin) {
    const user = await AuthRepository.findUserById(id);
    
    if (!user) {
      throw new Error('Credenciais Incorretas do usuário');
    }

    if (user.lastValidToken !== tokenLogin && user.lastValidToken !== null) {
      throw new Error('Sessão inválida (possível login em outro dispositivo)');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error('Credenciais Incorretas da senha');
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await AuthRepository.updateUserToken(user._id, token);

    return {
      token,
      user: {
        authenticated: true,
        username: user.username,
        role: user.role,
      }
    };
  }

  static async logout(token) {
    if (!token) return;

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        decoded = jwt.decode(token);
      } else {
        throw err;
      }
    }

    if (decoded?.id) {
      await AuthRepository.invalidateUserToken(decoded.id);
    }
  }

  static verifyToken(token) {
    if (!token) {
      return { authenticated: false };
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return {
        authenticated: true,
        username: decoded.username,
        role: decoded.role,
      };
    } catch {
      return { authenticated: false };
    }
  }
}

module.exports = AuthService;