const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/bienes', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT b.*, a.detalle as articulo_detalle, c.nombre as clase_nombre, m.nombre as metodo_nombre,
               o.nombre as obra_nombre FROM af_bien b
               LEFT JOIN stock a ON b.articuloid = a.stockid
               LEFT JOIN af_clasebien c ON b.clasebienid = c.id
               LEFT JOIN af_metodoamort m ON b.metodoamort = m.id
               LEFT JOIN obras o ON b.obraid = o.codigo`;
    const params = [];
    if (search) {
      sql += ` WHERE b.detalle ILIKE $1 OR b.serie ILIKE $1 OR b.id ILIKE $1 OR a.detalle ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY b.fechaalta DESC LIMIT 500`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/bienes/:id', async (req, res) => {
  try {
    const r = await db.query(`SELECT b.*, a.detalle as articulo_detalle, c.nombre as clase_nombre,
      m.nombre as metodo_nombre, o.nombre as obra_nombre
      FROM af_bien b
      LEFT JOIN stock a ON b.articuloid = a.stockid
      LEFT JOIN af_clasebien c ON b.clasebienid = c.id
      LEFT JOIN af_metodoamort m ON b.metodoamort = m.id
      LEFT JOIN obras o ON b.obraid = o.codigo
      WHERE b.id = $1`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Bien no encontrado' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/clases', async (req, res) => { try {
    const r = await db.query('SELECT * FROM af_clasebien ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/metodosamort', async (req, res) => { try {
    const r = await db.query('SELECT * FROM af_metodoamort ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/mantenimiento', async (req, res) => { try {
    const r = await db.query('SELECT * FROM af_mant ORDER BY fecha DESC LIMIT 500');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/mejoras', async (req, res) => { try {
    const r = await db.query('SELECT * FROM af_mejoras ORDER BY fecha DESC LIMIT 500');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
