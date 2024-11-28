const express = require("express");
const router = express.Router();
const User = require('../models/usuariosSchema')
const jwt = require('jsonwebtoken')


router.post("/login", async (req, res) => {
    const { id, password } = req.body;


    try {
        // Verifica se o usuário existe
        const user = await User.findOne({ id });
        if (!user) {
            return res.status(401).json({ message: "Credenciais Incorretas do usuario" });
        }

        // Compara a senha fornecida com a armazenada
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: "Credenciais Incorretas da senha" });
        }

        // Gera o token JWT
        const token = jwt.sign(
            { id: user._id, role: user.role, username:user.username },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        // Envia o token no cookie
        res.cookie('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'None',
        });

        res.json({
            authenticated: true,
            username: user.username,
            role:user.role
        });
    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ message: "Erro interno do servidor" });
    }
});

router.post("/logout", (req, res) => {
    // Limpa o cookie 'authToken' definindo uma data de expiração no passado
    res.cookie('authToken', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Pode ser removido ou ajustado se não estiver em produção
        maxAge: 0, // Define o tempo de expiração do cookie para 0, efetivamente apagando-o
        sameSite: 'strict',
    });

    // Retorna uma resposta de sucesso
    return res.json({ message: "Logout realizado com sucesso" });
});

router.get('/verify', (req, res) => {
    const token = req.cookies.get('authToken'); // Recupera o token do cookie

    if (!token) {
        return res.status(401).json({ authenticated: false });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(decoded)
        res.json({
            authenticated: true,
            username: decoded.username,
            role:decoded.role // Ou qualquer informação que você tenha no token
        });
    } catch (err) {
        return res.status(401).json({ authenticated: false });
    }
});



module.exports = router;