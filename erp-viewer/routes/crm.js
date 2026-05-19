const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/incidentes', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT i.*, e.descripcion as estado_nombre, t.descripcion as tipo_nombre, c.nombre as cliente_nombre,
               p.nombre as proveedor_nombre, g.detalle as grupo_nombre
               FROM hd_incidentes i
               LEFT JOIN hd_estados e ON i.estadoid = e.id
               LEFT JOIN hd_tipo t ON i.tipoid = t.id
               LEFT JOIN clientes c ON i.clienteid = c.clienteid
               LEFT JOIN proveedo p ON i.proveedorid = p.proveedor
               LEFT JOIN hd_grupos g ON i.grupoid = g.id`;
    const params = [];
    if (search) {
      sql += ` WHERE i.descripcion ILIKE $1 OR i.numero ILIKE $1 OR c.nombre ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY i.fecha DESC LIMIT 500`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/incidentes/:id', async (req, res) => {
  try {
    const r = await db.query(`SELECT i.*, e.descripcion as estado_nombre, t.descripcion as tipo_nombre,
      c.nombre as cliente_nombre, p.nombre as proveedor_nombre, g.detalle as grupo_nombre
      FROM hd_incidentes i
      LEFT JOIN hd_estados e ON i.estadoid = e.id
      LEFT JOIN hd_tipo t ON i.tipoid = t.id
      LEFT JOIN clientes c ON i.clienteid = c.clienteid
      LEFT JOIN proveedo p ON i.proveedorid = p.proveedor
      LEFT JOIN hd_grupos g ON i.grupoid = g.id
      WHERE i.id = $1`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Incidente no encontrado' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/novedades', async (req, res) => { try {
    const r = await db.query('SELECT * FROM hd_novedades ORDER BY id DESC LIMIT 500');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/estados', async (req, res) => { try {
    const r = await db.query('SELECT * FROM hd_estados ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/tipos', async (req, res) => { try {
    const r = await db.query('SELECT * FROM hd_tipo ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/grupos', async (req, res) => { try {
    const r = await db.query('SELECT * FROM hd_grupos ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/seguimiento', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM seguimiento ORDER BY fecha DESC LIMIT 500');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/acciones', async (req, res) => { try {
    const r = await db.query('SELECT * FROM hd_acciones ORDER BY fecha DESC LIMIT 500');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/circuitos', async (req, res) => { try {
    const r = await db.query('SELECT * FROM seg_circuitos ORDER BY circuito');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/etapas', async (req, res) => { try {
    const r = await db.query('SELECT * FROM seg_etapas ORDER BY detalle');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/crmproyectos', async (req, res) => { try {
    const r = await db.query('SELECT * FROM crm_proyectos ORDER BY nombre DESC LIMIT 200');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
