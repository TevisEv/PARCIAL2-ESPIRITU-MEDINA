const jwt = require("jsonwebtoken");
const db = require("../config/db");

async function authJwt(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ message: "Token faltante" });

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return res.status(401).json({ message: "Token inválido" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar en DB
    const result = await db.query("SELECT * FROM auth_tokens WHERE token = $1", [token]);
    if (result.rowCount === 0 || result.rows[0].revoked_at) {
      return res.status(401).json({ message: "Sesión inválida" });
    }

    // Obtener datos frescos del usuario (Rol y Grupo)
    const userRes = await db.query("SELECT id, username, role, group_id FROM users WHERE id = $1", [result.rows[0].user_id]);
    
    if (userRes.rowCount === 0) return res.status(401).json({ message: "Usuario no existe" });

    req.user = userRes.rows[0]; // { id, username, role, group_id }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token expirado o error" });
  }
}

module.exports = authJwt;