const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/rutas', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM logi_rutas ORDER BY detalle');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/hruta', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let sql = `SELECT h.*, e.detalle as estado_nombre, r.detalle as ruta_nombre
               FROM logi_hruta h
               LEFT JOIN logi_hestados e ON h.estado = e.id
               LEFT JOIN logi_rutas r ON h.rutaid = r.id`;
    const conditions = []; const params = [];
    if (desde) { conditions.push(`h.fecha >= $${params.length + 1}`); params.push(desde); }
    if (hasta) { conditions.push(`h.fecha <= $${params.length + 1}`); params.push(hasta); }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY h.fecha DESC LIMIT 500`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/hrutai', async (req, res) => { try {
    const r = await db.query('SELECT * FROM logi_hrutai ORDER BY id DESC LIMIT 500');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/hestados', async (req, res) => { try {
    const r = await db.query('SELECT * FROM logi_hestados ORDER BY detalle');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/rutaclientes', async (req, res) => { try {
    const r = await db.query('SELECT r.*, l.detalle as ruta_nombre, c.nombre as cli_nombre FROM logi_rutaclie r LEFT JOIN logi_rutas l ON r.logi_rutaid = l.id LEFT JOIN clientes c ON r.clienteid = c.clienteid ORDER BY r.logi_rutaid');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/rutadocs', async (req, res) => { try {
    const r = await db.query('SELECT d.*, l.detalle as ruta_nombre FROM logi_rutadoc d LEFT JOIN logi_rutas l ON d.logi_rutaid = l.id ORDER BY d.logi_rutaid DESC LIMIT 500');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/configdocs', async (req, res) => { try {
    const r = await db.query('SELECT * FROM logi_configdocs ORDER BY detalle');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/camiones', async (req, res) => { try {
    const r = await db.query('SELECT * FROM camiones ORDER BY patente');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/choferes', async (req, res) => { try {
    const r = await db.query('SELECT * FROM choferes ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/despachos', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM despacho';
    const params = [];
    if (search) { sql += ` WHERE detalle ILIKE $1 OR numero ILIKE $1 OR buque ILIKE $1`; params.push(`%${search}%`); }
    sql += ` ORDER BY fembarque DESC NULLS LAST LIMIT 500`;
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
