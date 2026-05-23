const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/ordenespago', async (req, res) => {
  try {
    const { search, desde, hasta, limit, offset } = req.query;
    let sql = `SELECT p.promoviid, p.clase, p.codigo, p.comp, p.fecha, p.fechaven,
               p.nombre, p.cuit, p.neto, p.iva, p.percepcion, p.retencion,
               (COALESCE(p.neto,0)+COALESCE(p.iva,0)+COALESCE(p.percepcion,0)+COALESCE(p.retencion,0)) as total,
               p.pago, p.moneda, p.estadoreg, p.proveedor, p.comprob, p.ordcomp,
               p.pagosid, p.nota,
               pg.detalle as pago_nombre
               FROM promovi p
               LEFT JOIN pagos pg ON p.pago = pg.pago
               WHERE p.clase IN ('A','B','C') AND p.neto != 0`;
    const conditions = []; const params = [];
    if (search) {
      conditions.push(`(p.comp::text ILIKE $${params.length+1} OR p.nombre ILIKE $${params.length+1} OR p.proveedor ILIKE $${params.length+1})`);
      params.push(`%${search}%`);
    }
    if (desde) { conditions.push(`p.fecha >= $${params.length+1}`); params.push(desde); }
    if (hasta) { conditions.push(`p.fecha <= $${params.length+1}`); params.push(hasta); }
    if (conditions.length > 0) sql += ` AND ` + conditions.join(' AND ');
    sql += ` ORDER BY p.fecha DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit) || 500, parseInt(offset) || 0);
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/ordenespago/:id/aplicacion', async (req, res) => {
  try {
    const { id } = req.params;

    const orden = await db.query(`
      SELECT p.*, pg.detalle as pago_nombre
      FROM promovi p LEFT JOIN pagos pg ON p.pago = pg.pago
      WHERE p.promoviid = $1`, [id]);

    if (orden.rows.length === 0) return res.status(404).json({ error: 'Orden no encontrada' });

    const imp = await db.query(`
      SELECT pi.codigo, pi.comp, SUM(pi.importe) as importe,
             MAX(pi.detalle) as detalle,
             MAX(pi.recibo) as recibo_origen,
             MAX(pi.fecha) as fecha,
             MIN(m.neto) as fac_neto, MIN(m.iva) as fac_iva,
             MIN(m.exento) as fac_exento, MIN(m.percepcion) as fac_percepcion,
             MIN(m.fecha) as fac_fecha, MIN(m.fechaven) as fac_fechaven,
             MIN(m.nombre) as fac_cliente, MIN(m.cuit) as fac_cuit,
             MIN((COALESCE(m.neto,0)+COALESCE(m.iva,0)+COALESCE(m.exento,0)+COALESCE(m.percepcion,0))) as fac_total,
             MIN(m.campocae) as fac_cae, MIN(m.estadodoc) as fac_estado,
             MIN(t.nombre) as fac_tipo
      FROM proimpu pi
      LEFT JOIN movi m ON m.comp = pi.comp
      LEFT JOIN tranparamventas t ON pi.codigo = t.codigo
      WHERE pi.parentpromoviid = $1
      GROUP BY pi.codigo, pi.comp
      ORDER BY MIN(pi.fecha)`, [id]);

    let totalAplicado = 0;
    const imputaciones = imp.rows.map(r => {
      totalAplicado += parseFloat(r.importe) || 0;
      return {
        codigo_factura: r.codigo,
        comp_factura: r.comp,
        tipo_factura: r.fac_tipo,
        importe_aplicado: r.importe,
        detalle: r.detalle,
        fecha_aplicacion: r.fecha,
        recibo_origen: r.recibo,
        factura: r.fac_total ? {
          total: r.fac_total,
          neto: r.fac_neto,
          iva: r.fac_iva,
          exento: r.fac_exento,
          percepcion: r.fac_percepcion,
          fecha: r.fac_fecha,
          vencimiento: r.fac_fechaven,
          cliente: r.fac_cliente,
          cuit: r.fac_cuit,
          cae: r.fac_cae,
          estado: r.fac_estado
        } : null
      };
    });

    res.json({
      orden: orden.rows[0],
      imputaciones,
      total_orden: (parseFloat(orden.rows[0].neto)||0) + (parseFloat(orden.rows[0].iva)||0) + (parseFloat(orden.rows[0].percepcion)||0) + (parseFloat(orden.rows[0].retencion)||0),
      total_aplicado: totalAplicado
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/egresos', async (req, res) => {
  try {
    const { search, desde, hasta, limit, offset } = req.query;
    let sql = `SELECT cm.cajamovid, cm.fecha, cm.comp, cm.detalle, cm.impentra, cm.impsale,
               cm.cliente, cm.proveedor, cm.cuenta, cm.banco, cm.numcheque, cm.tipo,
               cm.moneda, cm.cotizacionid, cm.estadoreg, cm.chequeraid,
               b.nombre as banco_nombre, ct.nombre as cuenta_nombre
               FROM cajamov cm
               LEFT JOIN bancos b ON cm.banco = b.codigo
               LEFT JOIN cuentas ct ON cm.cuenta = ct.cuenta AND cm.caja = ct.caja`;
    const conditions = []; const params = [];
    if (search) {
      conditions.push(`(cm.comp::text ILIKE $${params.length+1} OR cm.detalle ILIKE $${params.length+1} OR cm.cliente ILIKE $${params.length+1} OR cm.proveedor ILIKE $${params.length+1})`);
      params.push(`%${search}%`);
    }
    if (desde) { conditions.push(`cm.fecha >= $${params.length+1}`); params.push(desde); }
    if (hasta) { conditions.push(`cm.fecha <= $${params.length+1}`); params.push(hasta); }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY cm.fecha DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit) || 500, parseInt(offset) || 0);
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/comprobantescompra', async (req, res) => {
  try {
    const { search, desde, hasta, limit, offset } = req.query;
    let sql = `SELECT m.moviid, m.clase, m.codigo, m.comp, m.fecha, m.fechaven,
               m.clienteid, m.cliente, m.nombre, m.cuit, m.neto, m.iva, m.exento, m.percepcion,
               (COALESCE(m.neto,0)+COALESCE(m.iva,0)+COALESCE(m.exento,0)+COALESCE(m.percepcion,0)) as total,
               m.estadodoc, m.remito, m.comprob
               FROM movi m WHERE m.clase='A'`;
    const conditions = []; const params = [];
    if (search) {
      conditions.push(`(m.comp::text ILIKE $${params.length+1} OR m.nombre ILIKE $${params.length+1} OR m.cliente ILIKE $${params.length+1})`);
      params.push(`%${search}%`);
    }
    if (desde) { conditions.push(`m.fecha >= $${params.length+1}`); params.push(desde); }
    if (hasta) { conditions.push(`m.fecha <= $${params.length+1}`); params.push(hasta); }
    if (conditions.length > 0) sql += ` AND ` + conditions.join(' AND ');
    sql += ` ORDER BY m.fecha DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit) || 500, parseInt(offset) || 0);
    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
