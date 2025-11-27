const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const authJwt = require("../middlewares/authJwt");

const router = express.Router();

/**
 * POST /auth/register
 * Crea un usuario nuevo (username único)
 */
router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "username y password son requeridos" });
  }

  try {
    // ¿Usuario ya existe?
    const existing = await db.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({ message: "El usuario ya existe" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       RETURNING id, username, created_at`,
      [username, passwordHash]
    );

    const user = result.rows[0];

    res.status(201).json({
      id: user.id,
      username: user.username,
      created_at: user.created_at,
    });
  } catch (err) {
    console.error("Error en /auth/register:", err);
    res.status(500).json({ message: "Error interno al registrar usuario" });
  }
});

/**
 * POST /auth/login
 * Verifica credenciales, genera JWT y registra el token en auth_tokens.
 */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "username y password son requeridos" });
  }

  try {
    const userResult = await db.query(
      "SELECT id, username, password_hash FROM users WHERE username = $1",
      [username]
    );

    if (userResult.rowCount === 0) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const user = userResult.rows[0];

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const payload = {
      sub: user.id,
      username: user.username,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    });

    // Calculamos expires_at desde el JWT
    const decoded = jwt.decode(token);
    let expiresAt = null;
    if (decoded && decoded.exp) {
      expiresAt = new Date(decoded.exp * 1000);
    }

    // Guardar token en la tabla auth_tokens
    await db.query(
      `INSERT INTO auth_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    res.json({ token });
  } catch (err) {
    console.error("Error en /auth/login:", err);
    res
      .status(500)
      .json({ message: "Error interno al intentar iniciar sesión" });
  }
});

/**
 * POST /auth/logout
 * Marca el token actual como revocado en la base.
 */
router.post("/logout", authJwt, async (req, res) => {
  const authHeader = req.headers["authorization"];
  const [, token] = authHeader.split(" ");

  try {
    await db.query(
      `UPDATE auth_tokens
       SET revoked_at = NOW()
       WHERE token = $1`,
      [token]
    );

    res.json({ message: "Sesión cerrada correctamente" });
  } catch (err) {
    console.error("Error en /auth/logout:", err);
    res.status(500).json({ message: "Error al cerrar sesión" });
  }
});

module.exports = router;
