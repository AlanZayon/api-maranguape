const express = require('express');
const router = express.Router();
const User = require('../models/usuariosSchema');
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
  const { id, password } = req.body;

  const tokenLogin = req.cookies.authToken;

  try {
    const user = await User.findOne({ id });
    if (!user)
      return res
        .status(401)
        .json({ message: 'Credenciais Incorretas do usuário' });

    if (
      !user ||
      (user.lastValidToken !== tokenLogin && user.lastValidToken !== null)
    ) {
      return res.status(401).json({
        message: 'Sessão inválida (possível login em outro dispositivo)',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      if (!isMatch)
        return res
          .status(401)
          .json({ message: 'Credenciais Incorretas da senha' });

    const token = jwt.sign(
      { id: user._id, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    user.lastValidToken = token;
    await user.save();

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      authenticated: true,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno', error: err.message });
  }
});

router.post('/logout', async (req, res) => {
  const token = req.cookies.authToken;
  if (!token) return res.sendStatus(204);

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user) {
      user.lastValidToken = null;
      await user.save();
    }

    res.clearCookie('authToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });
    res.status(200).json({ message: 'Logout realizado com sucesso!' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      decoded = jwt.decode(token);
    } else {
      return res
        .status(500)
        .json({ message: 'Erro no logout', error: err.message });
    }
  }

  if (decoded?.id) {
    const user = await User.findById(decoded.id);
    if (user) {
      user.lastValidToken = null;
      await user.save();
    }
  }
});

router.get('/verify', (req, res) => {
  const token = req.cookies.authToken;

  if (!token) {
    return res.status(401).json({ authenticated: false });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    res.json({
      authenticated: true,
      username: decoded.username,
      role: decoded.role,
    });
  } catch {
    return res.status(401).json({ authenticated: false });
  }
});

module.exports = router;
