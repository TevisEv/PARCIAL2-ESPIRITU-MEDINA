// =====================================================
//  AUTENTICACIÓN · UNAS TASK MANAGER
//  Login, registro y logout
// =====================================================

const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const authJwt = require("../middlewares/authJwt");

const router = express.Router();

// =====================================================
// 1. LOGIN (público)
// =====================================================
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Verificar usuario
    const userRes = await db.query(
      `SELECT *
       FROM users
       WHERE username = $1`,
      [username]
    );

    if (userRes.rowCount === 0)
      return res.status(401).json({ message: "Credenciales inválidas" });

    const user = userRes.rows[0];

    // Verificar contraseña
    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass)
      return res.status(401).json({ message: "Credenciales inválidas" });

    // Generar token
    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Guardar token
    await db.query(
      `INSERT INTO auth_tokens (user_id, token)
       VALUES ($1, $2)`,
      [user.id, token]
    );

    res.json({
      token,
      role: user.role,
      username: user.username
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================================================
// 2. REGISTRO
// =====================================================
router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Verificar duplicado
    const exists = await db.query(
      `SELECT 1 FROM users WHERE username = $1`,
      [username]
    );

    if (exists.rowCount > 0)
      return res.status(400).json({ message: "El usuario ya existe" });

    // Crear usuario alumno por defecto
    const hash = await bcrypt.hash(password, 10);

    const newUser = await db.query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, 'alumno')
       RETURNING id`,
      [username, hash]
    );

    res.json({
      message: "Usuario registrado correctamente",
      user_id: newUser.rows[0].id
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================================================
// 3. LOGOUT (privado)
// =====================================================
router.post("/logout", authJwt, async (req, res) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];

    if (!token)
      return res.status(400).json({ message: "Token no encontrado" });

    await db.query(
      `UPDATE auth_tokens
       SET revoked_at = NOW()
       WHERE token = $1`,
      [token]
    );

    res.json({ message: "Sesión cerrada correctamente" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
