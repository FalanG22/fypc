const express = require('express');
const router = express.Router();
const db = require('../db');

const STATS_QUERY = `
  SELECT 'clientes' as tabla, COUNT(*) as total FROM clientes
  UNION ALL SELECT 'stock', COUNT(*) FROM stock
  UNION ALL SELECT 'movi (comprobantes)', COUNT(*) FROM movi
  UNION ALL SELECT 'pedidos', COUNT(*) FROM pedidos
  UNION ALL SELECT 'proveedo', COUNT(*) FROM proveedo
  UNION ALL SELECT 'movmer', COUNT(*) FROM movmer
  UNION ALL SELECT 'cajamov', COUNT(*) FROM cajamov
  UNION ALL SELECT 'transacasientos', COUNT(*) FROM transacasientos
  ORDER BY tabla
`;

router.get('/', async (req, res) => {
  try {
    const stats = await db.query(STATS_QUERY);
    res.render('index', { stats: stats.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar dashboard');
  }
});

router.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.query(STATS_QUERY);
    const extra = await db.query(`
      SELECT 's_empleados' as tabla, COUNT(*) as total FROM s_empleados
      UNION ALL SELECT 'p_ordenes', COUNT(*) FROM p_ordenes
      UNION ALL SELECT 'o_licitacion', COUNT(*) FROM o_licitacion
      UNION ALL SELECT 'af_bien', COUNT(*) FROM af_bien
      UNION ALL SELECT 'o_ec_products', COUNT(*) FROM o_ec_products
      UNION ALL SELECT 'hd_incidentes', COUNT(*) FROM hd_incidentes
      UNION ALL SELECT 'logi_rutas', COUNT(*) FROM logi_rutas
    `);
    res.json({ main: stats.rows, extra: extra.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
