const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/empleados', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT e.*, a.nombre as area_nombre, cat.nombre as categoria_nombre,
               p.nombre as puesto_nombre, em.nombre as empresa_nombre
               FROM s_empleados e
               LEFT JOIN s_areas a ON e.areaid = a.id
               LEFT JOIN s_categorias cat ON e.categoriaid = cat.id
               LEFT JOIN s_puestos p ON e.puestoid = p.id
               LEFT JOIN s_empresas em ON e.empresaid = em.id`;
    const params = [];
    if (search) {
      sql += ` WHERE e.nombre ILIKE $1 OR e.codigo ILIKE $1 OR e.documento ILIKE $1 OR e.cuil ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY e.nombre LIMIT 500`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/empleados/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT e.*, a.nombre as area_nombre, cat.nombre as categoria_nombre,
      p.nombre as puesto_nombre, em.nombre as empresa_nombre, os.nombre as osocial_nombre,
      s.nombre as sindicato_nombre, cv.nombre as convenio_nombre, tc.nombre as contratacion_nombre
      FROM s_empleados e
      LEFT JOIN s_areas a ON e.areaid = a.id
      LEFT JOIN s_categorias cat ON e.categoriaid = cat.id
      LEFT JOIN s_puestos p ON e.puestoid = p.id
      LEFT JOIN s_empresas em ON e.empresaid = em.id
      LEFT JOIN s_obrasociales os ON e.obrasocialid = os.id
      LEFT JOIN s_sindicatos s ON e.sindicatoid = s.id
      LEFT JOIN s_convenios cv ON e.convenioid = cv.id
      LEFT JOIN s_tipocontratacion tc ON e.tipocontratacionid = tc.id
      WHERE e.id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/liquidaciones', async (req, res) => {
  try {
    const { search, desde, hasta } = req.query;
    let sql = `SELECT l.*, p.nombre as periodo_nombre FROM s_liquidacion l LEFT JOIN s_periodos p ON l.periodoid = p.id`;
    const conditions = []; const params = [];
    if (desde) { conditions.push(`l.fecha >= $${params.length + 1}`); params.push(desde); }
    if (hasta) { conditions.push(`l.fecha <= $${params.length + 1}`); params.push(hasta); }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY l.fecha DESC LIMIT 200`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/novedades', async (req, res) => {
  try {
    const { search, desde, hasta } = req.query;
    let sql = `SELECT n.*, e.nombre as empleado_nombre FROM s_novedades n LEFT JOIN s_empleados e ON n.empleadoid = e.id`;
    const conditions = []; const params = [];
    if (desde) { conditions.push(`n.periodoid = (SELECT id FROM s_periodos WHERE fecha >= $${params.length + 1} LIMIT 1)`); params.push(desde); }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY n.id DESC LIMIT 200`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/conceptos', async (req, res) => { try {
    const r = await db.query('SELECT * FROM s_conceptos ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/areas', async (req, res) => { try {
    const r = await db.query('SELECT * FROM s_areas ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/puestos', async (req, res) => { try {
    const r = await db.query('SELECT * FROM s_puestos ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/categorias', async (req, res) => { try {
    const r = await db.query('SELECT * FROM s_categorias ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/obrasociales', async (req, res) => { try {
    const r = await db.query('SELECT * FROM s_obrasociales ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/sindicatos', async (req, res) => { try {
    const r = await db.query('SELECT * FROM s_sindicatos ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/convenios', async (req, res) => { try {
    const r = await db.query('SELECT * FROM s_convenios ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/periodos', async (req, res) => { try {
    const r = await db.query('SELECT * FROM s_periodos ORDER BY fecha DESC');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/empresas', async (req, res) => { try {
    const r = await db.query('SELECT * FROM s_empresas ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/tiposcontratacion', async (req, res) => { try {
    const r = await db.query('SELECT * FROM s_tipocontratacion ORDER BY nombre');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/conceptosliquidados', async (req, res) => { try {
    const r = await db.query('SELECT * FROM s_liquidaconceptos ORDER BY liquidacionid');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
