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

// Middleware global
router.use(authJwt);
router.use(authorize(["admin"]));

// =====================================================
// 1. Dashboard: grupos, usuarios y docentes
// =====================================================
router.get("/dashboard-data", async (req, res) => {
  try {
    const teacherId = req.user.id;

    // 1. Total de TAREAS PUBLICADAS (únicas por título)
    const tareasPublicadas = await db.query(
      `SELECT COUNT(DISTINCT title) AS total
       FROM tasks
       WHERE created_by = $1`,
      [teacherId]
    );

    // 2. Total de grupos asignados al docente
    const misGrupos = await db.query(
      `SELECT COUNT(*) AS total
       FROM teacher_groups
       WHERE teacher_id = $1`,
      [teacherId]
    );

    // 3. Total de alumnos alcanzados (tareas enviadas, pero conteo individual por envío)
    const alumnosAlcanzados = await db.query(
      `SELECT COUNT(*) AS total
       FROM tasks
       WHERE created_by = $1`,
      [teacherId]
    );

    // 4. Últimas tareas enviadas
    const ultimasTareas = await db.query(
      `SELECT t.*, u.username AS alumno, g.name AS group_name
       FROM tasks t
       JOIN users u ON u.id = t.assigned_to
       LEFT JOIN groups g ON g.id = t.group_id
       WHERE t.created_by = $1
       ORDER BY t.id DESC
       LIMIT 10`,
      [teacherId]
    );

    res.json({
      tareasPublicadas: tareasPublicadas.rows[0].total,
      misGrupos: misGrupos.rows[0].total,
      alumnosAlcanzados: alumnosAlcanzados.rows[0].total,
      ultimasTareas: ultimasTareas.rows
    });

  } catch (err) {
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
    const finalGroup = role === "alumno" ? group_id : null;

    const hash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO users (username, password_hash, role, group_id)
       VALUES ($1, $2, $3, $4)`,
      [username, hash, role, finalGroup]
    );

    res.json({ message: "Usuario creado correctamente" });

  } catch (err) {
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
       ON CONFLICT DO NOTHING`,
      [teacher_id, group_id]
    );

    res.json({ message: "Asignación realizada correctamente" });

  } catch (err) {
    res.status(500).json({ message: "Error al asignar docente" });
  }
});

module.exports = router;
