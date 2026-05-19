const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const { search, rubro } = req.query;
    let sql = `SELECT s.*, r.nombre as rubro_nombre, l.nombre as linea_nombre
               FROM stock s
               LEFT JOIN rubros r ON s.rubro = r.codigo
               LEFT JOIN lineas l ON s.linea = l.codigo`;
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(`(s.clave ILIKE $${params.length + 1} OR s.detalle ILIKE $${params.length + 1} OR s.codbar ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (rubro) {
      conditions.push(`s.rubro = $${params.length + 1}`);
      params.push(rubro);
    }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY s.detalle LIMIT 200`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/rubros', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM rubros ORDER BY codigo');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, r.nombre as rubro_nombre, l.nombre as linea_nombre,
             f.nombre as familia_nombre, g.nombre as grupo_nombre
      FROM stock s
      LEFT JOIN rubros r ON s.rubro = r.codigo
      LEFT JOIN lineas l ON s.linea = l.codigo
      LEFT JOIN familias f ON s.familia = f.codigo
      LEFT JOIN grupos g ON s.grupo = g.codigo
      WHERE s.stockid = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/movimientos', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM movmer
      WHERE stockid = $1
      ORDER BY fecha DESC LIMIT 500
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/stock', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM stock_co WHERE stockid = $1 ORDER BY depositoid
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
