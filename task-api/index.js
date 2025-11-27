const express = require("express");
const authRoutes = require("./routes/auth");
const tasksRoutes = require("./routes/tasks");

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);   // POST /auth/login
app.use("/tasks", tasksRoutes); // CRUD con JWT

const PORT = process.env.PORT || 3200;
app.listen(PORT, () => {
  console.log(`Task-API escuchando en puerto ${PORT}`);
});
