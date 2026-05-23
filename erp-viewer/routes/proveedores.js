const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const { search, limit, offset } = req.query;
    let sql = `SELECT p.*, pr.nombre as provnom FROM proveedo p LEFT JOIN provin pr ON p.provincia = pr.codigo`;
    const params = [];
    if (search) {
      sql += ` WHERE (p.proveedor ILIKE $${params.length + 1} OR p.nombre ILIKE $${params.length + 1} OR p.deno ILIKE $${params.length + 1} OR p.cuit ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY p.nombre LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit) || 500, parseInt(offset) || 0);
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, pr.nombre as provnom FROM proveedo p
      LEFT JOIN provin pr ON p.provincia = pr.codigo
      WHERE p.proveedor = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
