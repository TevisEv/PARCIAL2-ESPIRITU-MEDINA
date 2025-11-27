const jwt = require("jsonwebtoken");
const db = require("../config/db");

async function authJwt(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Formato de token inválido" });
  }

  try {
    // 1) Verificar firma y expiración del JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 2) Verificar que el token exista en DB y no esté revocado ni expirado
    const result = await db.query(
      `SELECT id, user_id, token, created_at, expires_at, revoked_at
       FROM auth_tokens
       WHERE token = $1`,
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Token no registrado o inválido" });
    }

    const dbToken = result.rows[0];

    if (dbToken.revoked_at) {
      return res.status(401).json({ message: "Token revocado" });
    }

    if (dbToken.expires_at && new Date(dbToken.expires_at) < new Date()) {
      return res.status(401).json({ message: "Token expirado" });
    }

    // 3) Adjuntamos usuario al request
    req.user = {
      id: dbToken.user_id,
      username: decoded.username,
    };

    next();
  } catch (err) {
    console.error("Error en authJwt:", err);
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
}

module.exports = authJwt;
