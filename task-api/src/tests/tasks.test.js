const request = require('supertest');
const express = require('express');
const tasksRoutes = require('../routes/tasks');

// 1. MOCK de la Base de Datos (Para que funcione sin PostgreSQL real)
const mockQuery = jest.fn();
jest.mock('../config/db', () => ({
  query: (text, params) => mockQuery(text, params)
}));

// 2. MOCK de Autenticación (Middleware)
// Por defecto simulamos ser un 'docente'
const mockAuthUser = { id: 1, role: 'docente', username: 'ProfeTest' };
jest.mock('../middlewares/authJwt', () => (req, res, next) => {
  req.user = mockAuthUser;
  next();
});

const app = express();
app.use(express.json());
app.use('/tasks', tasksRoutes);

describe('Tabla de Decisión: POST /tasks', () => {
  beforeEach(() => {
    mockQuery.mockClear();
    mockAuthUser.role = 'docente'; // Resetear a docente antes de cada test
  });

  // REGLA 1: Usuario NO es docente (Alumno) -> Error 403
  test('Regla 1: Debe denegar acceso si es Alumno', async () => {
    mockAuthUser.role = 'alumno'; // Cambiamos rol temporalmente
    
    const res = await request(app).post('/tasks').send({ title: 'Test', group_id: 1, mode: 'all' });
    expect(res.statusCode).toBe(403);
  });

  // REGLA 2: Docente, Modo 'all', pero base de datos no devuelve alumnos -> Error 400
  test('Regla 2: Error 400 si modo all no encuentra alumnos', async () => {
    // Simulamos respuesta vacía de la BD al buscar alumnos
    mockQuery.mockResolvedValueOnce({ rows: [] }); 

    const res = await request(app).post('/tasks').send({ title: 'Test', group_id: 1, mode: 'all' });
    expect(res.statusCode).toBe(400);
  });

  // REGLA 3: Docente, Modo 'all', con alumnos encontrados -> Éxito 200
  test('Regla 3: Éxito si modo all encuentra alumnos', async () => {
    // 1er query: busca alumnos (devuelve 1 alumno)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 10 }] }); 
    // 2do query: inserta tarea (éxito)
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).post('/tasks').send({ title: 'Test', group_id: 1, mode: 'all' });
    expect(res.statusCode).toBe(200);
  });

  // REGLA 4: Docente, Modo 'selected', lista vacía -> Error 400
  test('Regla 4: Error 400 si modo selected envía lista vacía', async () => {
    const res = await request(app).post('/tasks').send({ 
      title: 'Test', group_id: 1, mode: 'selected', student_ids: [] 
    });
    expect(res.statusCode).toBe(400);
  });

  // REGLA 5: Docente, Modo 'selected', lista con datos -> Éxito 200
  test('Regla 5: Éxito si modo selected tiene alumnos', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1 }); // Simular insert exitoso

    const res = await request(app).post('/tasks').send({ 
      title: 'Test', group_id: 1, mode: 'selected', student_ids: [10, 11] 
    });
    expect(res.statusCode).toBe(200);
  });
});