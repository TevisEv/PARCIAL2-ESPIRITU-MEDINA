// =====================================================
//  ADMINISTRACIÓN · UNAS TASK MANAGER
//  Rutas exclusivas del administrador
// =====================================================

const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const authJwt = require("../middlewares/authJwt");
const authorize = require("../middlewares/roleCheck");

const router = express.Router();

// Middleware global: Requiere Token y Rol 'admin'
router.use(authJwt);
router.use(authorize(["admin"]));

// =====================================================
// 1. Dashboard: Data para el panel de administración
//    (Devuelve listas para llenar tablas y desplegables)
// =====================================================
router.get("/dashboard-data", async (req, res) => {
  try {
    console.log("Admin Dashboard: Solicitando datos...");

    // 1. Obtener todos los grupos (para los Selects)
    const groups = await db.query("SELECT * FROM groups ORDER BY id");

    // 2. Obtener solo docentes (para asignar responsabilidad)
    const teachers = await db.query("SELECT id, username FROM users WHERE role = 'docente' ORDER BY username");

    // 3. Obtener lista completa de usuarios (para la tabla inferior)
    const users = await db.query(`
      SELECT u.id, u.username, u.role, g.name as group_name
      FROM users u
      LEFT JOIN groups g ON u.group_id = g.id
      ORDER BY u.id DESC
    `);

    // RESPUESTA JSON CORRECTA
    res.json({
      groups: groups.rows,
      teachers: teachers.rows,
      users: users.rows
    });

  } catch (err) {
    console.error("Error en admin dashboard:", err);
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 2. Crear usuario
// =====================================================
router.post("/create-user", async (req, res) => {
  const { username, password, role, group_id } = req.body;

  try {
    if (!username || !password || !role) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    // Si es alumno → asignar grupo; si no → null
    const finalGroup = (role === "alumno" && group_id) ? group_id : null;

    const hash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO users (username, password_hash, role, group_id)
       VALUES ($1, $2, $3, $4)`,
      [username, hash, role, finalGroup]
    );

    res.json({ message: "Usuario creado correctamente" });

  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Error al crear usuario (¿duplicado?)" });
  }
});

// =====================================================
// 3. Crear grupo
// =====================================================
router.post("/create-group", async (req, res) => {
  const { name } = req.body;

  try {
    if (!name) return res.status(400).json({ message: "Nombre requerido" });

    await db.query(
      `INSERT INTO groups (name)
       VALUES ($1)`,
      [name]
    );

    res.json({ message: "Grupo creado correctamente" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creando grupo" });
  }
});

// =====================================================
// 4. Asignar docente a grupo
// =====================================================
router.post("/assign-teacher", async (req, res) => {
  const { teacher_id, group_id } = req.body;

  try {
    if (!teacher_id || !group_id) {
      return res.status(400).json({ message: "Faltan datos de asignación" });
    }

    await db.query(
      `INSERT INTO teacher_groups (teacher_id, group_id)
       VALUES ($1, $2)
       ON CONFLICT (teacher_id, group_id) DO NOTHING`,
      [teacher_id, group_id]
    );

    res.json({ message: "Asignación realizada correctamente" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al asignar docente" });
  }
});

module.exports = router;