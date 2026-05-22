const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { auth } = require('./middleware/auth');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use('/', require('./routes/dashboard'));
app.use('/api/auth', require('./routes/auth'));

const apiRoutes = [
  ['/api/clientes', './routes/clientes'],
  ['/api/comprobantes', './routes/comprobantes'],
  ['/api/stock', './routes/stock'],
  ['/api/proveedores', './routes/proveedores'],
  ['/api/movimientos', './routes/movimientos'],
  ['/api/tesoreria', './routes/tesoreria'],
  ['/api/contabilidad', './routes/contabilidad'],
  ['/api/geografia', './routes/geografia'],
  ['/api/schema', './routes/schema'],
  ['/api/rrhh', './routes/rrhh'],
  ['/api/produccion', './routes/produccion'],
  ['/api/logistica', './routes/logistica'],
  ['/api/obras', './routes/obras'],
  ['/api/ecommerce', './routes/ecommerce'],
  ['/api/impuestos', './routes/impuestos'],
  ['/api/crm', './routes/crm'],
  ['/api/activosfijos', './routes/activosfijos'],
  ['/api/auxiliares', './routes/auxiliares'],
  ['/api/pedidos', './routes/pedidos'],
  ['/api/cobranzas', './routes/cobranzas'],
  ['/api/ventas', './routes/ventas'],
  ['/api/compras-tesoreria', './routes/compras_tesoreria'],
  ['/api/maestros', './routes/maestros'],
  ['/api/ctacte', './routes/ctacte'],
];
apiRoutes.forEach(([mount, mod]) => {
  app.use(mount, auth, require(mod));
});

async function initDB() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        nombre VARCHAR(255),
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const admin = await db.query('SELECT id FROM usuarios WHERE username = $1', ['admin']);
    if (admin.rows.length === 0) {
      const hash = await bcrypt.hash('b1618Awj', 10);
      await db.query(
        'INSERT INTO usuarios (username, password, role, nombre) VALUES ($1,$2,$3,$4)',
        ['admin', hash, 'admin', 'Administrador']
      );
      console.log('Usuario admin creado');
    }
    const guest = await db.query('SELECT id FROM usuarios WHERE username = $1', ['guest']);
    if (guest.rows.length === 0) {
      const hash = await bcrypt.hash('b1618Awj', 10);
      await db.query(
        'INSERT INTO usuarios (username, password, role, nombre) VALUES ($1,$2,$3,$4)',
        ['guest', hash, 'user', 'Invitado']
      );
      console.log('Usuario guest creado');
    }
    console.log('Base de datos inicializada');
  } catch (e) {
    console.error('Error inicializando BD:', e.message);
  }
}

app.listen(PORT, async () => {
  console.log(`ERP Viewer corriendo en http://localhost:${PORT}`);
  await initDB();
});
