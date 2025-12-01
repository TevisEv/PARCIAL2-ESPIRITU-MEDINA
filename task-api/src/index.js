const express = require("express");
const path = require("path");
const authRoutes = require("./routes/auth");
const tasksRoutes = require("./routes/tasks");
const adminRoutes = require("./routes/admin");

const app = express();

// Configuración de Vistas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public"))); // Opcional para CSS
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Rutas API
app.use("/auth", authRoutes);
app.use("/tasks", tasksRoutes);
app.use("/admin", adminRoutes);

// Rutas Vistas
app.get("/", (req, res) => res.render("index"));
app.get("/login", (req, res) => res.render("login"));
app.get("/register", (req, res) => res.render("register"));

// Paneles (Protegidos por Login en el Frontend via JS)
app.get("/panel-admin", (req, res) => res.render("panel_admin"));
app.get("/panel-docente", (req, res) => res.render("panel_docente"));
app.get("/panel-alumno", (req, res) => res.render("panel_alumno"));
app.get("/dashboard", (req, res) => res.render("dashboard"));
app.get('/docente/grupos', (req, res) => res.render('docente_grupos'));



const PORT = process.env.PORT || 3200;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log("🔥 Cambio detectado!");
});