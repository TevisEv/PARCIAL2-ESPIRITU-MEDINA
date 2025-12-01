const express = require("express");
const authJwt = require("../middlewares/authJwt");
const db = require("../config/db");
const router = express.Router();

// -------------------------------------------
// Middleware: Requiere token JWT
// -------------------------------------------
router.use(authJwt);

// ===========================================
// 1. DOCENTE — Obtener grupos asignados
// ===========================================
router.get("/my-groups", async (req, res) => {
  if (req.user.role !== "docente") return res.json([]); // Alumno/Admin → vacío

  try {
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

// ===========================================
// 2. Obtener alumnos de un grupo
// ===========================================
router.get("/students/:groupId", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username 
       FROM users 
       WHERE group_id = $1 AND role = 'alumno'`,
      [req.params.groupId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================================
// 3. DOCENTE — Crear tareas
// ===========================================
router.post("/", async (req, res) => {
  if (req.user.role === "alumno")
    return res.status(403).json({ message: "No autorizado" });

  const { title, group_id, mode, student_ids } = req.body;

  try {
    let targetStudents = [];

    // Modo: "todos los alumnos"
    if (mode === "all") {
      const studentsResult = await db.query(
        "SELECT id FROM users WHERE group_id = $1 AND role = 'alumno'",
        [group_id]
      );
      targetStudents = studentsResult.rows.map((r) => r.id);
    } else {
      // Modo: selección manual
      targetStudents = student_ids || [];
    }

    if (targetStudents.length === 0)
      return res.status(400).json({ message: "No hay alumnos" });

    // Insertar una tarea por alumno
    for (const studentId of targetStudents) {
      await db.query(
        `INSERT INTO tasks (title, assigned_to, created_by, group_id)
         VALUES ($1, $2, $3, $4)`,
        [title, studentId, req.user.id, group_id]
      );
    }

    res.json({ message: "Tareas creadas exitosamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creando tarea" });
  }
});

// ===========================================
// 4. Ver tareas (Docente o Alumno)
// ===========================================
router.get("/", async (req, res) => {
  try {
    let query;

    if (req.user.role === "alumno") {
      // Tareas asignadas al alumno
      query = `
        SELECT t.*, u.username AS docente, g.name AS group_name
        FROM tasks t
        JOIN users u ON t.created_by = u.id
        LEFT JOIN groups g ON t.group_id = g.id
        WHERE t.assigned_to = $1
        ORDER BY t.id DESC
      `;
    } else {
      // Historial del docente
      query = `
        SELECT t.*, u.username AS alumno, g.name AS group_name
        FROM tasks t
        JOIN users u ON t.assigned_to = u.id
        LEFT JOIN groups g ON t.group_id = g.id
        WHERE t.created_by = $1
        ORDER BY t.id DESC
      `;
    }

    const result = await db.query(query, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//---------------------------------------------
// 5. TAREAS PENDIENTES (solo alumno)
//---------------------------------------------
router.get("/pending", async (req, res) => {
  if (req.user.role !== 'alumno')
    return res.json([]); // solo alumnos

  try {
    const result = await db.query(
      `SELECT t.*, u.username AS docente, g.name AS group_name
       FROM tasks t
       JOIN users u ON t.created_by = u.id
       LEFT JOIN groups g ON t.group_id = g.id
       WHERE t.assigned_to = $1 AND t.done = false
       ORDER BY t.id DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


//---------------------------------------------
// 6. TAREAS COMPLETADAS (solo alumno)
//---------------------------------------------
router.get("/done", async (req, res) => {
  if (req.user.role !== 'alumno')
    return res.json([]);

  try {
    const result = await db.query(
      `SELECT t.*, u.username AS docente, g.name AS group_name
       FROM tasks t
       JOIN users u ON t.created_by = u.id
       LEFT JOIN groups g ON t.group_id = g.id
       WHERE t.assigned_to = $1 AND t.done = true
       ORDER BY t.id DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//---------------------------------------------
// 7. MARCAR TAREA COMO COMPLETADA (solo alumno)
//---------------------------------------------
router.patch("/:id/complete", async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE tasks 
       SET done = true 
       WHERE id = $1 AND assigned_to = $2 
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Tarea no encontrada o no pertenece al alumno"
      });
    }

    res.json({ message: "Tarea marcada como completada" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ===========================================
// 8. DOCENTE — Eliminar tarea
// ===========================================
router.delete("/:id", async (req, res) => {
  try {
    await db.query(
      "DELETE FROM tasks WHERE id = $1 AND created_by = $2",
      [req.params.id, req.user.id]
    );

    res.json({ message: "Eliminada" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// -------------------------------------------
module.exports = router;
