-- Habilitar pgcrypto para usar crypt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Borrar tablas si existen (orden correcto por FK)
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS auth_tokens;
DROP TABLE IF EXISTS teacher_groups;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS groups;

-- Tabla de grupos (curso, seccion, etc.)
CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

-- Usuarios con rol
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'docente', 'alumno')),
  group_id INTEGER REFERENCES groups(id), -- Solo para alumnos
  created_at TIMESTAMP DEFAULT NOW()
);

-- Relacion DOCENTE -> MUCHOS GRUPOS
CREATE TABLE teacher_groups (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  UNIQUE(teacher_id, group_id)
);

-- Tokens de sesion
CREATE TABLE auth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP
);

-- Tareas asignadas
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  assigned_to INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  group_id INTEGER REFERENCES groups(id),
  done BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Usuario admin por defecto
INSERT INTO users (username, password_hash, role)
VALUES ('admin@unas.com', crypt('Tevis123!', gen_salt('bf')), 'admin');
