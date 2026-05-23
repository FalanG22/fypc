const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/cuentas', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM c_cuentas ORDER BY codigo');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/plancuentas', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM c_plancuentas ORDER BY codigo');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/asientos', async (req, res) => {
  try {
    const { search, desde, hasta, limit, offset } = req.query;
    let sql = `SELECT *, CASE WHEN tipo='D' THEN importe ELSE 0 END as debe, CASE WHEN tipo='H' THEN importe ELSE 0 END as haber FROM transacasientos`;
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(`(comp ILIKE $${params.length + 1} OR leyenda ILIKE $${params.length + 1} OR dato ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (desde) { conditions.push(`fecha >= $${params.length + 1}`); params.push(desde); }
    if (hasta) { conditions.push(`fecha <= $${params.length + 1}`); params.push(hasta); }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY fecha DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit) || 500, parseInt(offset) || 0);
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
