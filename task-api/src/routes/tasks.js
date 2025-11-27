const express = require("express");
const authJwt = require("../middlewares/authJwt");
const db = require("../config/db");
const router = express.Router();

router.use(authJwt);

// 1. Obtener grupos del docente logueado
router.get("/my-groups", async (req, res) => {
  // Si no es docente, devolver vacío
  if (req.user.role !== 'docente') return res.json([]);
  
  try {
    // JOIN con la tabla teacher_groups para ver qué tiene asignado este docente
    const result = await db.query(
      `SELECT g.id, g.name 
       FROM groups g 
       JOIN teacher_groups tg ON g.id = tg.group_id 
       WHERE tg.teacher_id = $1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Obtener alumnos de un grupo específico
router.get("/students/:groupId", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, username FROM users WHERE group_id = $1 AND role = 'alumno'",
      [req.params.groupId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Crear Tarea
router.post("/", async (req, res) => {
  if (req.user.role === 'alumno') return res.status(403).json({ message: "No autorizado" });

  const { title, group_id, mode, student_ids } = req.body;

  try {
    let targetStudents = [];

    if (mode === 'all') {
      // Buscar todos los alumnos del grupo
      const resStudents = await db.query("SELECT id FROM users WHERE group_id = $1 AND role = 'alumno'", [group_id]);
      targetStudents = resStudents.rows.map(r => r.id);
    } else {
      // Usar lista manual
      targetStudents = student_ids || [];
    }

    if (targetStudents.length === 0) return res.status(400).json({ message: "No hay alumnos" });

    // Insertar tarea para cada alumno
    for (const studentId of targetStudents) {
      await db.query(
        "INSERT INTO tasks (title, assigned_to, created_by, group_id) VALUES ($1, $2, $3, $4)",
        [title, studentId, req.user.id, group_id]
      );
    }

    res.json({ message: "Tareas creadas exitosamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creando tarea" });
  }
});

// 4. Ver Tareas
router.get("/", async (req, res) => {
  try {
    let query;
    if (req.user.role === 'alumno') {
      query = `SELECT t.*, u.username as docente, g.name as group_name 
               FROM tasks t 
               JOIN users u ON t.created_by = u.id 
               LEFT JOIN groups g ON t.group_id = g.id
               WHERE t.assigned_to = $1 ORDER BY t.id DESC`;
    } else {
      query = `SELECT t.*, u.username as alumno, g.name as group_name 
               FROM tasks t 
               JOIN users u ON t.assigned_to = u.id 
               LEFT JOIN groups g ON t.group_id = g.id
               WHERE t.created_by = $1 ORDER BY t.id DESC`;
    }
    const result = await db.query(query, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Borrar Tarea
router.delete("/:id", async (req, res) => {
    await db.query("DELETE FROM tasks WHERE id = $1 AND created_by = $2", [req.params.id, req.user.id]);
    res.json({ message: "Eliminada" });
});

module.exports = router;