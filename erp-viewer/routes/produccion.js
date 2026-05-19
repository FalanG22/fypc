const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/ordenes', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT o.*, pr.nombre as proceso_nombre, prog.nombre as programa_nombre, ob.nombre as obra_nombre
               FROM p_ordenes o
               LEFT JOIN p_procesos pr ON o.p_planificaprocesosid = pr.p_planificaprocesosid
               LEFT JOIN p_programa prog ON o.programaid = prog.id
               LEFT JOIN obras ob ON o.obra = ob.codigo`;
    const params = [];
    if (search) {
      sql += ` WHERE o.numero ILIKE $1 OR o.obs ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY o.fecha DESC LIMIT 500`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ordenesdetalle', async (req, res) => { try {
    const r = await db.query('SELECT * FROM p_ordenesdet ORDER BY p_ordenesid DESC LIMIT 500');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/procesos', async (req, res) => {
  try {
    const r = await db.query('SELECT p.*, s.detalle as sector_nombre FROM p_procesos p LEFT JOIN p_sectores s ON p.sector = s.id ORDER BY p.nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/programas', async (req, res) => { try {
    const r = await db.query('SELECT * FROM p_programa ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/sectores', async (req, res) => { try {
    const r = await db.query('SELECT * FROM p_sectores ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/partes', async (req, res) => { try {
    const r = await db.query('SELECT * FROM p_partes ORDER BY fecha DESC LIMIT 500');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/partesdet', async (req, res) => { try {
    const r = await db.query('SELECT * FROM p_partesdet ORDER BY p_partesid DESC LIMIT 500');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/procesoproductivo', async (req, res) => { try {
    const r = await db.query('SELECT * FROM p_procproductivo ORDER BY id');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/alternativas', async (req, res) => { try {
    const r = await db.query('SELECT * FROM p_alternativas ORDER BY id');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/recursosproceso', async (req, res) => { try {
    const r = await db.query('SELECT * FROM p_recursosproceso LIMIT 500');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
