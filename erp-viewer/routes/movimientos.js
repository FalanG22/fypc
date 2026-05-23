const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/mercaderia', async (req, res) => {
  try {
    const { search, desde, hasta, limit } = req.query;
    let sql = `SELECT m.*, s.detalle as art_detalle
               FROM movmer m
               LEFT JOIN stock s ON m.stockid = s.stockid`;
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(`(m.remito ILIKE $${params.length + 1} OR m.factura ILIKE $${params.length + 1} OR m.cliente ILIKE $${params.length + 1} OR s.detalle ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (desde) { conditions.push(`m.fecha >= $${params.length + 1}`); params.push(desde); }
    if (hasta) { conditions.push(`m.fecha <= $${params.length + 1}`); params.push(hasta); }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY m.fecha DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit) || 500);
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/caja', async (req, res) => {
  try {
    const { search, desde, hasta, limit } = req.query;
    let sql = `SELECT cm.comp, MIN(cm.fecha) as fecha,
               cm.cliente, c.nombre as cliente_nombre,
               cm.proveedor, p.nombre as proveedor_nombre,
               COUNT(*) as items,
               SUM(cm.impentra) as total_ingreso,
               SUM(cm.impsale) as total_egreso,
               MIN(b.nombre) as banco_nombre
               FROM cajamov cm
               LEFT JOIN clientes c ON cm.cliente = c.cliente::text
               LEFT JOIN proveedo p ON cm.proveedor = p.proveedor::text
               LEFT JOIN bancos b ON cm.banco = b.codigo`;
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(`(cm.comp ILIKE $${params.length+1} OR cm.cliente ILIKE $${params.length+1} OR c.nombre ILIKE $${params.length+1} OR cm.proveedor ILIKE $${params.length+1} OR p.nombre ILIKE $${params.length+1})`);
      params.push(`%${search}%`);
    }
    if (desde) { conditions.push(`cm.fecha >= $${params.length+1}`); params.push(desde); }
    if (hasta) { conditions.push(`cm.fecha <= $${params.length+1}`); params.push(hasta); }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` GROUP BY cm.comp, cm.cliente, c.nombre, cm.proveedor, p.nombre ORDER BY MIN(cm.fecha) DESC LIMIT $${params.length+1}`;
    params.push(parseInt(limit) || 500);
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/caja/grupos/:comp', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cm.detalle, cm.cuenta, cm.cliente, c.nombre as cliente_nombre,
              cm.proveedor, p.nombre as proveedor_nombre,
              cm.banco, b.nombre as banco_nombre,
              cm.tipo, cm.fecha,
              SUM(cm.impentra) as total_ingreso,
              SUM(cm.impsale) as total_egreso,
              COUNT(*) as renglones
       FROM cajamov cm
       LEFT JOIN clientes c ON cm.cliente = c.cliente::text
       LEFT JOIN proveedo p ON cm.proveedor = p.proveedor::text
       LEFT JOIN bancos b ON cm.banco = b.codigo
       WHERE cm.comp = $1
       GROUP BY cm.detalle, cm.cuenta, cm.cliente, c.nombre, cm.proveedor, p.nombre, cm.banco, b.nombre, cm.tipo, cm.fecha
       ORDER BY MIN(cm.cajamovid)`,
      [req.params.comp]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mercaderia/grupos', async (req, res) => {
  try {
    const { search, desde, hasta, limit } = req.query;
    let sql = `SELECT remito, MIN(fecha) as fecha, cliente,
               COUNT(*) as items, SUM(cantidad) as total_cant
               FROM movmer`;
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(`(remito ILIKE $${params.length+1} OR cliente ILIKE $${params.length+1})`);
      params.push(`%${search}%`);
    }
    if (desde) { conditions.push(`fecha >= $${params.length+1}`); params.push(desde); }
    if (hasta) { conditions.push(`fecha <= $${params.length+1}`); params.push(hasta); }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` GROUP BY remito, cliente ORDER BY MIN(fecha) DESC LIMIT $${params.length+1}`;
    params.push(parseInt(limit) || 500);
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mercaderia/grupos/:remito', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.stockid, MAX(s.detalle) as art_detalle, SUM(m.cantidad) as cantidad,
              AVG(m.precio) as precio, MAX(m.deposito) as deposito,
              MAX(m.tipomov) as tipomov, MIN(m.fecha) as fecha,
              COUNT(*) as renglones
       FROM movmer m
       LEFT JOIN stock s ON m.stockid = s.stockid
       WHERE m.remito = $1
       GROUP BY m.stockid
       ORDER BY MIN(m.movmerid)`,
      [req.params.remito]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
