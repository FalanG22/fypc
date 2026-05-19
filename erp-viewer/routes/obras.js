const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/listado', async (req, res) => { try {
    const r = await db.query('SELECT * FROM obras ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/rubros', async (req, res) => { try {
    const r = await db.query('SELECT * FROM obrasrubros ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/licitaciones', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT l.*, o.nombre as obra_nombre, t.detalle as tipo_nombre, e.detalle as estado_nombre,
               m.detalle as motivo_nombre FROM o_licitacion l
               LEFT JOIN obras o ON l.obraid = o.codigo
               LEFT JOIN o_lic_tipo t ON l.tipo = t.id
               LEFT JOIN o_lic_estado e ON l.estado = e.id
               LEFT JOIN o_lic_motivo m ON l.motivo = m.id`;
    const params = [];
    if (search) {
      sql += ` WHERE l.licitacion ILIKE $1 OR l.expediente ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY l.fecha DESC LIMIT 500`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/polizas', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT p.*, o.nombre as obra_nombre, e.detalle as estado_nombre, g.detalle as garantia_nombre,
               m.detalle as motivo_nombre FROM o_poliza p
               LEFT JOIN obras o ON p.obraid = o.codigo
               LEFT JOIN o_pol_estado e ON p.estado = e.id
               LEFT JOIN o_pol_garantia g ON p.garantia = g.id
               LEFT JOIN o_pol_motivo m ON p.motivo = m.id`;
    const params = [];
    if (search) {
      sql += ` WHERE p.poliza ILIKE $1 OR p.asegura ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY p.fechaemi DESC LIMIT 500`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/licitaciones/tipos', async (req, res) => { try {
    const r = await db.query('SELECT * FROM o_lic_tipo ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/licitaciones/estados', async (req, res) => { try {
    const r = await db.query('SELECT * FROM o_lic_estado ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/polizas/estados', async (req, res) => { try {
    const r = await db.query('SELECT * FROM o_pol_estado ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
