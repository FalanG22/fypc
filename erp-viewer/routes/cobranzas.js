const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/recibos', async (req, res) => {
  try {
    const { search, desde, hasta, limit, offset } = req.query;
    let sql = `SELECT p.promoviid, p.clase, p.codigo, p.comp, p.fecha, p.fechaven,
               p.nombre, p.cuit, p.neto, p.iva, p.percepcion, p.retencion,
               (COALESCE(p.neto,0)+COALESCE(p.iva,0)+COALESCE(p.percepcion,0)+COALESCE(p.retencion,0)) as total,
               p.pago, p.moneda, p.estadoreg, p.proveedor as persona,
               p.nota, p.comprob, p.lreimputa,
               pg.detalle as pago_nombre
               FROM promovi p
               LEFT JOIN pagos pg ON p.pago = pg.pago`;
    const conditions = []; const params = [];
    if (search) {
      conditions.push(`(p.comp::text ILIKE $${params.length+1} OR p.nombre ILIKE $${params.length+1} OR p.cuit ILIKE $${params.length+1} OR p.proveedor ILIKE $${params.length+1})`);
      params.push(`%${search}%`);
    }
    if (desde) { conditions.push(`p.fecha >= $${params.length+1}`); params.push(desde); }
    if (hasta) { conditions.push(`p.fecha <= $${params.length+1}`); params.push(hasta); }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY p.fecha DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit) || 500, parseInt(offset) || 0);
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/recibos/:id', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT p.*, pg.detalle as pago_nombre
      FROM promovi p LEFT JOIN pagos pg ON p.pago = pg.pago
      WHERE p.promoviid = $1`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Recibo no encontrado' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/aplicaciones', async (req, res) => {
  try {
    const { search, limit, offset } = req.query;
    let sql = `SELECT pic.id, pic.fecha, pic.clase, pic.codigo, pic.comp, pic.proveedor,
               pic.totcomp, pic.totsaldo, pic.cancela, pic.cancelparcial, pic.fechaven, pic.cuota,
               pic.coef, pic.detalle, pic.cotizacionid, pic.monedaid,
               COALESCE(p.nombre, pic.proveedor) as persona_nombre
               FROM pagosimpcomp pic
               LEFT JOIN proveedo p ON pic.proveedor = p.proveedor`;
    const params = [];
    if (search) {
      sql += ` WHERE pic.comp::text ILIKE $${params.length+1} OR p.nombre ILIKE $${params.length+1} OR pic.proveedor ILIKE $${params.length+1}`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY pic.fecha DESC NULLS LAST LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit) || 500, parseInt(offset) || 0);
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/valores', async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const r = await db.query(`
      SELECT pv.id, pv.tipo, pv.importe, pv.banco, pv.numero, pv.vence, pv.clearing,
             pv.cajatipo, pv.caja, pv.cajadet, pv.interno, pv.esreten,
             b.nombre as banco_nombre
      FROM pagosimpvalores pv
      LEFT JOIN bancos b ON pv.banco = b.codigo
      ORDER BY pv.vence DESC NULLS LAST LIMIT $1 OFFSET $2`, [parseInt(limit) || 500, parseInt(offset) || 0]);
    res.json(r.rows.map(r => ({
      ...r,
      banco_mostrar: r.banco_nombre || r.banco || '',
      numero_mostrar: r.numero || ''
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/pagos', async (req, res) => {
  try {
    const r = await db.query('SELECT pago, detalle, dias1, des1, des2, tasa, punitorio, moneda_cancela FROM pagos ORDER BY pago');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
