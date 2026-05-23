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

const VENTA_CODIGOS = "'F','FS','C','CS','DS','OS','3','3S','4S'";

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
    const extra = await db.query(`SELECT 's_empleados' as tabla, COUNT(*) as total FROM s_empleados`);
    res.json({ main: stats.rows, extra: extra.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/dashboard/charts', async (req, res) => {
  try {
    const [ventas_mes, top_clientes, top_productos, formas_pago, vendedores] = await Promise.all([
      db.query(`
        SELECT to_char(fecha, 'YYYY-MM') as mes,
               SUM(COALESCE(neto,0) + COALESCE(iva,0)) as total,
               COUNT(*) as cantidad
        FROM movi
        WHERE codigo IN (${VENTA_CODIGOS})
          AND fecha >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY to_char(fecha, 'YYYY-MM')
        ORDER BY 1
      `),
      db.query(`
        SELECT c.clienteid, c.nombre,
               SUM(COALESCE(m.neto,0) + COALESCE(m.iva,0)) as total,
               COUNT(*) as comprobantes
        FROM movi m
        JOIN clientes c ON m.clienteid = c.clienteid
        WHERE m.codigo IN (${VENTA_CODIGOS})
        GROUP BY c.clienteid, c.nombre
        ORDER BY total DESC
        LIMIT 10
      `),
      db.query(`
        SELECT sv.stockid, COALESCE(MAX(s.detalle), 'S/D') as detalle,
               SUM(sv.cantidad) as cantidad_vendida,
               SUM(sv.cantidad * sv.precio) as total
        FROM stock_ve sv
        LEFT JOIN stock s ON sv.stockid = s.stockid
        GROUP BY sv.stockid
        ORDER BY total DESC
        LIMIT 10
      `),
      db.query(`
        SELECT COALESCE(p.detalle, 'S/D') as detalle,
               SUM(COALESCE(m.neto,0) + COALESCE(m.iva,0)) as total,
               COUNT(*) as comprobantes
        FROM movi m
        LEFT JOIN pagos p ON m.pago = p.pago
        WHERE m.codigo IN (${VENTA_CODIGOS})
        GROUP BY p.detalle
        ORDER BY total DESC
      `),
      db.query(`
        SELECT COALESCE(v.nom_ven, 'S/D') as vendedor,
               SUM(COALESCE(m.neto,0) + COALESCE(m.iva,0)) as total,
               COUNT(*) as comprobantes
        FROM movi m
        LEFT JOIN vendedor v ON m.vendedor = v.vendedor
        WHERE m.codigo IN (${VENTA_CODIGOS})
        GROUP BY v.nom_ven
        ORDER BY total DESC
      `),
    ]);
    res.json({
      ventas_mes: ventas_mes.rows,
      top_clientes: top_clientes.rows,
      top_productos: top_productos.rows,
      formas_pago: formas_pago.rows,
      vendedores: vendedores.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
