const express = require("express");
const authJwt = require("../middlewares/authJwt");
const db = require("../config/db");

const router = express.Router();

// Todas las rutas /tasks requieren JWT válido
router.use(authJwt);

// GET /tasks → solo tareas del usuario logueado
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, title, done, created_at, updated_at FROM tasks WHERE user_id = $1 ORDER BY id",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error en GET /tasks:", err);
    res.status(500).json({ message: "Error al obtener tareas" });
  }
});

// POST /tasks
router.post("/", async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ message: "title es requerido" });
  }

  try {
    const result = await db.query(
      `INSERT INTO tasks (user_id, title, done)
       VALUES ($1, $2, $3)
       RETURNING id, title, done, created_at, updated_at`,
      [req.user.id, title, false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error en POST /tasks:", err);
    res.status(500).json({ message: "Error al crear tarea" });
  }
});

// PUT /tasks/:id
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, done } = req.body;

  if (isNaN(id)) {
    return res.status(400).json({ message: "id inválido" });
  }

  try {
    const result = await db.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           done = COALESCE($2, done),
           updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, title, done, created_at, updated_at`,
      [title ?? null, done ?? null, id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error en PUT /tasks/:id:", err);
    res.status(500).json({ message: "Error al actualizar tarea" });
  }
});

// DELETE /tasks/:id
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ message: "id inválido" });
  }

  try {
    const result = await db.query(
      `DELETE FROM tasks
       WHERE id = $1 AND user_id = $2
       RETURNING id, title, done, created_at, updated_at`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error en DELETE /tasks/:id:", err);
    res.status(500).json({ message: "Error al eliminar tarea" });
  }
});

module.exports = router;
