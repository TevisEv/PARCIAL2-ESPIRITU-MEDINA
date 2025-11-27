const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

// Listener de errores para evitar crash total
pool.on('error', (err) => {
  console.error('Error inesperado en cliente de PG', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};