const express = require('express');
const router = express.Router();
const db = require('../db');

const DOC_VENTA = {F:'Factura A',FS:'Factura Servicios A',C:'N.Crédito A',CS:'NC Servicios A',
  DS:'ND Servicios A',OS:'Otros A','3':'Factura B','3S':'Factura Servicios B','4S':'NC Servicios B',R:'Remito',RS:'Remito Servicios'};

router.get('/', async (req, res) => {
  try {
    const { search, desde, hasta, limit } = req.query;
    let sql = `SELECT m.moviid, m.clase, m.codigo, m.comp, m.fecha, m.fechaven,
               m.clienteid, m.cliente, m.nombre, m.cuit, m.neto, m.iva, m.exento, m.percepcion,
               (COALESCE(m.neto,0)+COALESCE(m.iva,0)+COALESCE(m.exento,0)+COALESCE(m.percepcion,0)) as total,
               m.vendedor, m.pago, m.moneda, m.estadodoc, m.remito, m.factura, m.campocae as cae
               FROM movi m WHERE m.codigo IN ('F','FS','C','CS','DS','OS','3','3S','4S')`;
    const conditions = []; const params = [];
    if (search) {
      conditions.push(`(m.comp::text ILIKE $${params.length+1} OR m.nombre ILIKE $${params.length+1} OR m.cliente ILIKE $${params.length+1} OR m.cuit ILIKE $${params.length+1})`);
      params.push(`%${search}%`);
    }
    if (desde) { conditions.push(`m.fecha >= $${params.length+1}`); params.push(desde); }
    if (hasta) { conditions.push(`m.fecha <= $${params.length+1}`); params.push(hasta); }
    if (conditions.length > 0) sql += ` AND ` + conditions.join(' AND ');
    sql += ` ORDER BY m.fecha DESC LIMIT $${params.length+1}`;
    params.push(parseInt(limit) || 500);
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT m.*, (COALESCE(m.neto,0)+COALESCE(m.iva,0)+COALESCE(m.exento,0)+COALESCE(m.percepcion,0)) as total,
             v.nom_ven as vendedor_nombre, pg.detalle as pago_nombre
      FROM movi m
      LEFT JOIN vendedor v ON m.vendedor = v.vendedor
      LEFT JOIN pagos pg ON m.pago = pg.pago
      WHERE m.moviid = $1`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Comprobante no encontrado' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/detalle', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT DISTINCT ON (sv.clave, sv.precio)
             sv.clave, s.detalle as art_detalle, s.codbar, s.unidad,
             sv.cantidad, sv.precio as precio_unitario,
             (sv.cantidad * sv.precio) as subtotal,
             sv.descuento, sv.iva, sv.lote
      FROM stock_ve sv
      LEFT JOIN stock s ON sv.stockid = s.stockid
      WHERE sv.parentmoviid = $1 AND sv.precio > 0
      ORDER BY sv.clave, sv.precio, sv.regid`, [req.params.id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/documentos/tipos', async (req, res) => {
  try {
    res.json(Object.entries(DOC_VENTA).map(([c, d]) => ({ codigo: c, descripcion: d })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
