const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const authJwt = require("../middlewares/authJwt"); // Se importa, pero no se usa globalmente

const router = express.Router();

// --- NO PONGAS router.use(authJwt) AQUÍ ---

// LOGIN (Público: No lleva authJwt)
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userRes = await db.query("SELECT * FROM users WHERE username = $1", [username]);
    if (userRes.rowCount === 0) return res.status(401).json({ message: "Credenciales inválidas" });

    const user = userRes.rows[0];
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: "1h" });
    
    // Guardar token
    await db.query("INSERT INTO auth_tokens (user_id, token) VALUES ($1, $2)", [user.id, token]);

    // Responder con token y rol
    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// LOGOUT (Privado: SÍ lleva authJwt)
router.post("/logout", authJwt, async (req, res) => {
  const token = req.headers["authorization"].split(" ")[1];
  await db.query("UPDATE auth_tokens SET revoked_at = NOW() WHERE token = $1", [token]);
  res.json({ message: "Sesión cerrada" });
});

module.exports = router;