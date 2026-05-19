const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'b1618Awj',
  host: 'localhost',
  port: 5432,
  database: 'fypc',
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de BD:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
