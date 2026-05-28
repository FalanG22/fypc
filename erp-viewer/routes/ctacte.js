const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/resumen', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT c.clienteid, c.cliente, c.nombre, c.cuit, c.credito, c.credctacte,
             COALESCE(s.saldo, 0) as saldo_actual,
             COALESCE(s.debe, 0) as debe_total,
             COALESCE(s.haber, 0) as haber_total,
             COALESCE(s.vencido, 0) as vencido,
             COALESCE(s.ultimo_mov, c.fechaing) as ultimo_mov
      FROM clientes c
      LEFT JOIN (
        SELECT v.clienteid,
               SUM(v.neto * v.coef) as saldo,
               SUM(CASE WHEN v.coef > 0 THEN v.neto ELSE 0 END) as debe,
               SUM(CASE WHEN v.coef < 0 THEN ABS(v.neto) ELSE 0 END) as haber,
               SUM(CASE WHEN v.coef > 0 AND (v.fechaven < CURRENT_DATE OR v.fechaven IS NULL) THEN v.neto ELSE 0 END) as vencido,
               MAX(v.fecha) as ultimo_mov
        FROM qventasctacte v
        GROUP BY v.clienteid
      ) s ON c.clienteid = s.clienteid`;
    const params = [];
    if (search) {
      sql += ` WHERE c.nombre ILIKE $1 OR c.cliente ILIKE $1 OR c.cuit ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY s.saldo DESC NULLS LAST LIMIT 500`;
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/detalle/:clienteid', async (req, res) => {
  try {
    const { clienteid } = req.params;
    const { desde, hasta } = req.query;

    let sql = `
      SELECT v.moviid, v.fecha, v.fechaven, v.codigo, v.clase, v.comp,
             v.nombre as tipo_nombre, v.tipomov,
             v.coef, v.neto, v.iva, v.exento, v.percepcion,
             v.descuento, v.pago, v.remito, v.factura, v.obs,
             v.cotizacionid, v.moneda,
             CASE WHEN v.coef > 0 THEN v.neto ELSE 0 END as debe,
             CASE WHEN v.coef < 0 THEN ABS(v.neto) ELSE 0 END as haber
      FROM qventasctacte v
      WHERE v.clienteid = $1`;
    const params = [clienteid];
    if (desde) { sql += ` AND v.fecha >= $${params.length + 1}`; params.push(desde); }
    if (hasta) { sql += ` AND v.fecha <= $${params.length + 1}`; params.push(hasta); }
    sql += ` ORDER BY v.fecha, v.comp`;

    const r = await db.query(sql, params);
    let balance = 0;
    const rows = r.rows.map(row => {
      balance += parseFloat(row.neto) * row.coef;
      return { ...row, saldo_parcial: balance };
    });

    const totals = {
      total_debe: rows.filter(r => r.coef > 0).reduce((s, r) => s + parseFloat(r.neto), 0),
      total_haber: rows.filter(r => r.coef < 0).reduce((s, r) => s + Math.abs(parseFloat(r.neto)), 0),
      saldo_final: balance,
      vencido: rows.filter(r => r.coef > 0 && r.fechaven && new Date(r.fechaven) < new Date()).reduce((s, r) => s + parseFloat(r.neto), 0),
      cantidad: rows.length
    };

    res.json({ rows, totals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/clientes/:clienteid/comprobantes', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT m.moviid, m.codigo, m.clase, m.comp, m.fecha, m.fechaven,
             m.neto, m.iva, m.exento, m.percepcion,
             m.estadodoc, m.vendedor
      FROM movi m
      WHERE m.clienteid = $1
      ORDER BY m.fecha DESC LIMIT 100`, [req.params.clienteid]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/proveedores/resumen', async (req, res) => {
  try {
    const { search, fecha } = req.query;
    const fechaLimite = fecha || new Date().toISOString().slice(0, 10);
    let sql = `
      SELECT p.proveedor, p.nombre, p.deno, p.cuit, p.saldo as saldo_static,
             COALESCE(s.saldo_ctacte, 0) as saldo_ctacte,
             COALESCE(s.debe, 0) as debe_total,
             COALESCE(s.haber, 0) as haber_total,
             COALESCE(s.vencido, 0) as vencido,
             COALESCE(s.ultimo_mov, p.fecha) as ultimo_mov
      FROM proveedo p
      LEFT JOIN (
        SELECT q.proveedor,
               SUM(CASE WHEN (q.puntero IS NULL OR q.puntero = '' OR q.puntero !~ 'ODP') THEN q.neto ELSE -q.neto END) as saldo_ctacte,
               SUM(CASE WHEN (q.puntero IS NULL OR q.puntero = '' OR q.puntero !~ 'ODP') THEN q.neto ELSE 0 END) as debe,
               SUM(CASE WHEN (q.puntero IS NULL OR q.puntero = '' OR q.puntero !~ 'ODP') THEN 0 ELSE q.neto END) as haber,
               SUM(CASE WHEN (q.puntero IS NULL OR q.puntero = '' OR q.puntero !~ 'ODP') AND (q.fechaven < $1::date OR q.fechaven IS NULL) THEN q.neto ELSE 0 END) as vencido,
               MAX(q.fecha) as ultimo_mov
        FROM qcomprasctacte q
        WHERE q.fecha <= $1::date
        GROUP BY q.proveedor
      ) s ON p.proveedor = s.proveedor`;
    const params = [fechaLimite];
    if (search) {
      sql += ` WHERE (p.nombre ILIKE $${params.length + 1} OR p.deno ILIKE $${params.length + 1} OR p.cuit ILIKE $${params.length + 1} OR p.proveedor ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY COALESCE(s.saldo_ctacte, 0) DESC NULLS LAST`;
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/proveedores/detalle/:proveedor', async (req, res) => {
  try {
    const { proveedor } = req.params;
    const { desde, hasta } = req.query;
    const hastaDate = hasta || new Date().toISOString().slice(0, 10);
    let sql = `
      SELECT q.tipocomp, q.codigo, q.comp, q.fecha, q.fechaven, q.neto, q.iva,
             q.exento, q.percepcion, q.retencion, q.puntero, q.cerrado, q.clase,
             q.razon_social, q.cuit, q.nombre, q.nota, q.moneda, q.remito, q.orden,
             (COALESCE(q.neto,0)+COALESCE(q.iva,0)+COALESCE(q.exento,0)+COALESCE(q.percepcion,0)) as total,
             CASE WHEN (q.puntero IS NULL OR q.puntero = '' OR q.puntero !~ 'ODP') THEN 'DEBE' ELSE 'HABER' END as tipo_mov
      FROM qcomprasctacte q
      WHERE q.proveedor = $1 AND q.fecha <= $2::date`;
    const params = [proveedor, hastaDate];
    if (desde) { sql += ` AND q.fecha >= $${params.length + 1}`; params.push(desde); }
    sql += ` ORDER BY q.fecha, q.comp`;
    const r = await db.query(sql, params);
    let balance = 0;
    const rows = r.rows.map(row => {
      const esDebe = (row.puntero === null || row.puntero === '' || row.puntero.search(/ODP/) === -1);
      const signo = esDebe ? 1 : -1;
      balance += parseFloat(row.neto) * signo;
      return { ...row, saldo_parcial: balance, es_debe: esDebe, neto_signed: parseFloat(row.neto) * signo };
    });
    const totals = {
      total_debe: rows.filter(r => r.es_debe).reduce((s, r) => s + parseFloat(r.neto), 0),
      total_haber: rows.filter(r => !r.es_debe).reduce((s, r) => s + parseFloat(r.neto), 0),
      saldo_final: balance,
      vencido: rows.filter(r => r.es_debe && r.fechaven && new Date(r.fechaven) < new Date()).reduce((s, r) => s + parseFloat(r.neto), 0),
      cantidad: rows.length
    };
    res.json({ rows, totals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/proveedores/:proveedor/saldos', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT p.proveedor, p.nombre, p.deno, p.cuit, p.saldo as saldo_static,
             COALESCE(s.saldo_ctacte, 0) as saldo_ctacte,
             COALESCE(s.debe, 0) as debe_total,
             COALESCE(s.haber, 0) as haber_total,
             COALESCE(s.vencido, 0) as vencido
      FROM proveedo p
      LEFT JOIN (
        SELECT q.proveedor,
               SUM(CASE WHEN (q.puntero IS NULL OR q.puntero = '' OR q.puntero !~ 'ODP') THEN q.neto ELSE -q.neto END) as saldo_ctacte,
               SUM(CASE WHEN (q.puntero IS NULL OR q.puntero = '' OR q.puntero !~ 'ODP') THEN q.neto ELSE 0 END) as debe,
               SUM(CASE WHEN (q.puntero IS NULL OR q.puntero = '' OR q.puntero !~ 'ODP') THEN 0 ELSE q.neto END) as haber,
               SUM(CASE WHEN (q.puntero IS NULL OR q.puntero = '' OR q.puntero !~ 'ODP') AND (q.fechaven < CURRENT_DATE OR q.fechaven IS NULL) THEN q.neto ELSE 0 END) as vencido
        FROM qcomprasctacte q
        GROUP BY q.proveedor
      ) s ON p.proveedor = s.proveedor
      WHERE p.proveedor = $1`, [req.params.proveedor]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
