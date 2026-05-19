const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/provincias', async (req, res) => {
  try {
    const result = await db.query('SELECT p.*, pa.nombre as pais_nombre FROM provin p LEFT JOIN paises pa ON p.paisid = pa.id ORDER BY p.nombre');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/localidades', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT l.*, p.nombre as prov_nombre FROM localidades l LEFT JOIN provin p ON l.provinciaid = p.codigo`;
    const params = [];
    if (search) {
      sql += ` WHERE l.nombre ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY l.nombre LIMIT 200`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/paises', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM paises ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
