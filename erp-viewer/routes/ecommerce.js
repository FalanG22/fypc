const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/productos', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT p.*, s.detalle as stock_detalle, c.nombre as categoria_nombre, t.nombre as tipo_nombre,
               e.ml_estado as estado_nombre FROM o_ec_products p
               LEFT JOIN stock s ON p.stockid = s.stockid
               LEFT JOIN o_ec_categories c ON p.categoria = c.id
               LEFT JOIN o_ec_tipos t ON p.tipo = t.id
               LEFT JOIN o_ec_status e ON p.estado = e.estado`;
    const params = [];
    if (search) {
      sql += ` WHERE p.nombre ILIKE $1 OR p.detalle ILIKE $1 OR s.detalle ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY p.nombre LIMIT 500`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/categorias', async (req, res) => { try {
    const r = await db.query('SELECT * FROM o_ec_categories ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/tipos', async (req, res) => { try {
    const r = await db.query('SELECT * FROM o_ec_tipos ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/estados', async (req, res) => { try {
    const r = await db.query('SELECT * FROM o_ec_status ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/combos', async (req, res) => { try {
    const r = await db.query('SELECT * FROM o_ec_combos ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/combositems', async (req, res) => { try {
    const r = await db.query('SELECT * FROM o_ec_combos_items LIMIT 500');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/mlcategories', async (req, res) => { try {
    const r = await db.query('SELECT * FROM o_ml_categories ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/wccategories', async (req, res) => { try {
    const r = await db.query('SELECT * FROM o_wc_categories ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/usuariosweb', async (req, res) => { try {
    const r = await db.query('SELECT * FROM o_usuarios_web ORDER BY id');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
