const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/clientes', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT c.clienteid, c.cliente, c.nombre, c.deno, c.cuit, c.domicilio, c.localidad,
               c.codpos, c.email, c.telefono, c.vendedor, c.lista, c.lista2, c.moneda,
               c.credito, c.credctacte, c.taxcond, c.descuento, c.pago, c.zona,
               c.regiva, c.fechaing, c.estado, c.proveedor,
               p.nombre as provincia_nombre, z.nombre as zona_nombre,
               v.nom_ven as vendedor_nombre, pg.detalle as pago_nombre,
               cc.codigo as cta_contable_codigo, cc.nombre as cta_contable_nombre
               FROM clientes c
               LEFT JOIN provin p ON c.provincia = p.codigo
               LEFT JOIN zonas z ON c.zona = z.codigo
               LEFT JOIN vendedor v ON c.vendedor = v.vendedor
               LEFT JOIN pagos pg ON c.pago = pg.pago
               LEFT JOIN c_cuentas cc ON c.ctaactivo = cc.codigo`;
    const params = [];
    if (search) {
      sql += ` WHERE c.nombre ILIKE $1 OR c.cliente ILIKE $1 OR c.deno ILIKE $1 OR c.cuit ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY c.nombre LIMIT 500`;
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/clientes/:id', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT c.*, p.nombre as provincia_nombre, z.nombre as zona_nombre,
             v.nom_ven as vendedor_nombre, pg.detalle as pago_nombre,
             cc.codigo as cta_contable_codigo, cc.nombre as cta_contable_nombre,
             cr.codigo as cta_resultado_codigo, cr.nombre as cta_resultado_nombre
      FROM clientes c
      LEFT JOIN provin p ON c.provincia = p.codigo
      LEFT JOIN zonas z ON c.zona = z.codigo
      LEFT JOIN vendedor v ON c.vendedor = v.vendedor
      LEFT JOIN pagos pg ON c.pago = pg.pago
      LEFT JOIN c_cuentas cc ON c.ctaactivo = cc.codigo
      LEFT JOIN c_cuentas cr ON c.ctaresul = cr.codigo
      WHERE c.clienteid = $1`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/proveedores', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT p.proveedor, p.nombre, p.deno, p.cuit, p.domicilio, p.localidad,
               p.codpos, p.telefono, p.ivare, p.moneda, p.saldo, p.fecha, p.estado,
               p.taxcond, p.pago, p.persona, p.cliente,
               pr.nombre as provincia_nombre, pg.detalle as pago_nombre,
               cc.codigo as cta_pasivo_codigo, cc.nombre as cta_pasivo_nombre
               FROM proveedo p
               LEFT JOIN provin pr ON p.provincia = pr.codigo
               LEFT JOIN pagos pg ON p.pago = pg.pago
               LEFT JOIN c_cuentas cc ON p.ctapasivo = cc.codigo`;
    const params = [];
    if (search) {
      sql += ` WHERE p.nombre ILIKE $1 OR p.proveedor ILIKE $1 OR p.deno ILIKE $1 OR p.cuit ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY p.nombre LIMIT 500`;
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/proveedores/:id', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT p.*, pr.nombre as provincia_nombre, pg.detalle as pago_nombre,
             cc.codigo as cta_pasivo_codigo, cc.nombre as cta_pasivo_nombre
      FROM proveedo p
      LEFT JOIN provin pr ON p.provincia = pr.codigo
      LEFT JOIN pagos pg ON p.pago = pg.pago
      LEFT JOIN c_cuentas cc ON p.ctapasivo = cc.codigo
      WHERE p.proveedor = $1`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/plancuentas', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT cc.* FROM c_cuentas cc`;
    const params = [];
    if (search) {
      sql += ` WHERE cc.nombre ILIKE $1 OR cc.codigo ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY cc.codigo LIMIT 500`;
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/plancuentas/:id', async (req, res) => {
  try {
    const r = await db.query(`SELECT cc.*, ag.nombre as agrupa_nombre
      FROM c_cuentas cc LEFT JOIN c_cuentas ag ON cc.agrupa = ag.codigo WHERE cc.cuentacontid = $1`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Cuenta no encontrada' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/clientes/:id/comprobantes', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT m.moviid, m.clase, m.codigo, m.comp, m.fecha, m.fechaven, m.neto, m.iva,
             (COALESCE(m.neto,0)+COALESCE(m.iva,0)) as total, m.estadodoc
      FROM movi m WHERE m.clienteid = $1 ORDER BY m.fecha DESC LIMIT 100`, [req.params.id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
