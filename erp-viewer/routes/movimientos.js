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
    let sql = `SELECT cm.*, b.nombre as banco_nombre
               FROM cajamov cm
               LEFT JOIN bancos b ON cm.banco = b.codigo`;
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(`(cm.comp::text ILIKE $${params.length + 1} OR cm.detalle ILIKE $${params.length + 1} OR cm.cliente ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (desde) { conditions.push(`cm.fecha >= $${params.length + 1}`); params.push(desde); }
    if (hasta) { conditions.push(`cm.fecha <= $${params.length + 1}`); params.push(hasta); }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY cm.fecha DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit) || 500);
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
