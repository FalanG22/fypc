const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const { search, desde, hasta, limit, offset } = req.query;
    let sql = `SELECT p.pedidoid, p.codigo, p.numero, p.fecha, p.cliente, p.articulo,
               p.detalle, p.cantidad, p.precio, p.estado, p.moneda, p.cumplido,
               p.lugar, p.obs, s.detalle as art_detalle,
               c.nombre as cli_nombre
               FROM pedidos p
               LEFT JOIN stock s ON p.articulo = s.stockid
               LEFT JOIN clientes c ON p.cliente = c.clienteid`;
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(`(p.numero::text ILIKE $${params.length + 1} OR p.detalle ILIKE $${params.length + 1} OR s.detalle ILIKE $${params.length + 1} OR c.nombre ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (desde) { conditions.push(`p.fecha >= $${params.length + 1}`); params.push(desde); }
    if (hasta) { conditions.push(`p.fecha <= $${params.length + 1}`); params.push(hasta); }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY p.fecha DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit) || 500, parseInt(offset) || 0);
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/grupos', async (req, res) => {
  try {
    const { search, desde, hasta, limit, offset } = req.query;
    const l = Math.min(parseInt(limit) || 500, 1000);
    let sql = `SELECT p.numero, MIN(p.fecha) as fecha,
               p.cliente, MIN(c.nombre)::varchar as cli_nombre,
               COUNT(*)::int as items, SUM(p.cantidad)::float as total_cant,
               SUM(p.cantidad * p.precio)::float as total,
               MIN(p.estado)::varchar as estado, MIN(p.cumplido)::varchar as cumplido,
               COALESCE(MAX(mc.cnt),0)::int as mov_count
               FROM pedidos p
               LEFT JOIN clientes c ON c.clienteid = p.cliente
               LEFT JOIN (SELECT pedido, COUNT(*) as cnt FROM movmer GROUP BY pedido) mc ON mc.pedido = p.numero::text`;
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(`(p.numero::text ILIKE $${params.length + 1} OR c.nombre ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (desde) { conditions.push(`p.fecha >= $${params.length + 1}`); params.push(desde); }
    if (hasta) { conditions.push(`p.fecha <= $${params.length + 1}`); params.push(hasta); }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` GROUP BY p.numero, p.cliente ORDER BY fecha DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(l, parseInt(offset) || 0);
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/grupos/:numero', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.pedidoid, p.codigo, p.numero, p.fecha, p.articulo, p.cliente,
             p.detalle, p.cantidad, p.precio, p.estado, p.moneda, p.cumplido,
             COALESCE(s.detalle, p.articulo) as art_detalle,
             c.nombre as cli_nombre
      FROM pedidos p
      LEFT JOIN stock s ON s.stockid = p.articulo
      LEFT JOIN clientes c ON c.clienteid = p.cliente
      WHERE p.numero = $1
      ORDER BY p.pedidoid`, [req.params.numero]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/grupos/:numero/movimientos', async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const result = await db.query(`
      SELECT m.remito, m.fecha, m.cantidad, m.deposito,
             m.tipomov, COALESCE(s.detalle, m.stockid) as art_detalle
      FROM movmer m
      LEFT JOIN stock s ON s.stockid = m.stockid
      WHERE m.pedido = $1
      ORDER BY m.fecha DESC
      LIMIT $2 OFFSET $3`, [req.params.numero, parseInt(limit) || 100, parseInt(offset) || 0]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, s.detalle as art_detalle, c.nombre as cli_nombre
      FROM pedidos p
      LEFT JOIN stock s ON p.articulo = s.stockid
      LEFT JOIN clientes c ON p.cliente = c.clienteid
      WHERE p.pedidoid = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
