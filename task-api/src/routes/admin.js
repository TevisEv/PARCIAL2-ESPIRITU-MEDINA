const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const authJwt = require("../middlewares/authJwt");
const authorize = require("../middlewares/roleCheck");
const router = express.Router();

router.use(authJwt);
router.use(authorize(['admin']));

// Datos del Dashboard
router.get("/dashboard-data", async (req, res) => {
  try {
    const groups = await db.query("SELECT * FROM groups ORDER BY name");
    
    // Traer usuarios con el nombre de su grupo (si son alumnos)
    const users = await db.query(`
      SELECT u.id, u.username, u.role, g.name as group_name 
      FROM users u 
      LEFT JOIN groups g ON u.group_id = g.id 
      ORDER BY u.id DESC
    `);
    
    // Traer solo docentes para el dropdown de asignar
    const teachers = await db.query("SELECT id, username FROM users WHERE role = 'docente'");
    
    res.json({ groups: groups.rows, users: users.rows, teachers: teachers.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear Usuario
router.post("/create-user", async (req, res) => {
  const { username, password, role, group_id } = req.body;
  const hash = await bcrypt.hash(password, 10);
  
  try {
    // Si es docente, group_id se ignora aquí (se asigna después en assign-teacher)
    const finalGroupId = role === 'alumno' ? group_id : null;
    
    await db.query(
      "INSERT INTO users (username, password_hash, role, group_id) VALUES ($1, $2, $3, $4)",
      [username, hash, role, finalGroupId || null]
    );
    res.json({ message: "Usuario creado" });
  } catch (err) {
    res.status(400).json({ message: "Error al crear (¿Usuario duplicado?)" });
  }
});

// Crear Grupo
router.post("/create-group", async (req, res) => {
  try {
    await db.query("INSERT INTO groups (name) VALUES ($1)", [req.body.name]);
    res.json({ message: "Grupo creado" });
  } catch (err) {
    res.status(500).json({ message: "Error creando grupo" });
  }
});

// Asignar Docente a Grupo (ESTA ES LA CLAVE)
router.post("/assign-teacher", async (req, res) => {
  const { teacher_id, group_id } = req.body;
  try {
    await db.query(
      "INSERT INTO teacher_groups (teacher_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [teacher_id, group_id]
    );
    res.json({ message: "Asignación correcta" });
  } catch (err) {
    res.status(500).json({ message: "Error al asignar" });
  }
});

module.exports = router;