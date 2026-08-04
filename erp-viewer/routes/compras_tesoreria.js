const express = require('express');
const router = express.Router();
const db = require('../db');

function idSinClase(id) {
  const s = (id || '').trim();
  const m = s.match(/^([A-Z]{2})(\d+)([A-Z])(\d+)$/);
  return m ? `${m[1]}${m[2]}${m[4]}` : s;
}

function splitMediosRetenciones(rows) {
  const medios_pago = [];
  const retenciones = [];
  rows.forEach((row) => {
    if (row.es_retencion) retenciones.push(row);
    else medios_pago.push(row);
  });
  const cheques = medios_pago.filter(
    (m) =>
      m.valortipo === 'C' ||
      m.valortipo === 'P' ||
      (m.tipo_nombre && /cheque|echeq/i.test(m.tipo_nombre))
  );
  const transferencias = medios_pago.filter(
    (m) =>
      m.tipo === '04' ||
      (m.tipo_nombre && /transfer/i.test(m.tipo_nombre)) ||
      (m.detalle && /transfer/i.test(m.detalle))
  );
  return {
    medios_pago,
    retenciones,
    resumen: {
      cant_lineas: rows.length,
      cant_cheques: cheques.length,
      cant_transferencias: transferencias.length,
      cant_retenciones: retenciones.length,
      total_entrada: medios_pago.reduce((s, m) => s + (parseFloat(m.impentra) || 0), 0),
      total_salida: medios_pago.reduce((s, m) => s + (parseFloat(m.impsale) || 0), 0),
      total_retenido: retenciones.reduce(
        (s, m) => s + (parseFloat(m.impsale) || parseFloat(m.impentra) || 0),
        0
      ),
    },
  };
}

/** Caja de la OP: solo por pagosid / promoviid (sin comp suelto → evita CH/CQ/CD). */
async function queryMediosOrdenPago(promoviid, pagosId) {
  const ids = [...new Set([
    promoviid,
    idSinClase(promoviid),
    (pagosId || '').trim(),
  ].filter(Boolean))];
  if (!ids.length) return splitMediosRetenciones([]);

  const sql = `
    SELECT DISTINCT ON (cm.cajamovid)
           cm.cajamovid, cm.fecha, cm.comp, cm.detalle, cm.tipo, ct.nombre AS tipo_nombre,
           ct.valortipo, cm.documento, cm.impentra, cm.impsale, cm.numero, cm.numcheque,
           cm.vence, cm.banco, b.nombre AS banco_nombre, cm.cuenta, cu.nombre AS cuenta_nombre,
           cm.caja, cm.c_baseimponible, cm.c_alicuotaret,
           (COALESCE(cm.c_alicuotaret, 0) <> 0
            OR COALESCE(ct.retencion, '') = 'S'
            OR ct.nombre ILIKE '%Retención%'
            OR ct.nombre ILIKE '%retención%'
            OR cu.nombre ILIKE '%Reten%') AS es_retencion
    FROM cajamov cm
    LEFT JOIN cajatipo ct ON cm.tipo = ct.tipo
    LEFT JOIN bancos b ON TRIM(cm.banco::text) = TRIM(b.codigo::text)
    LEFT JOIN LATERAL (
      SELECT nombre FROM cuentas WHERE cuenta = cm.cuenta AND caja = cm.caja LIMIT 1
    ) cu ON true
    WHERE COALESCE(cm.reversion, 0) = 0
      AND (cm.parentpagoid = ANY($1::text[]) OR cm.parentpromoviid = ANY($1::text[]))
    ORDER BY cm.cajamovid, cm.fecha`;

  const r = await db.query(sql, [ids]);
  return splitMediosRetenciones(r.rows);
}

async function queryImputacionesOrdenPago(promoviid, pagosid) {
  const r = await db.query(
    `
    SELECT DISTINCT ON (pi.codigo, pi.comp, pi.importe, pi.fecha)
           pi.codigo AS codigo_factura,
           pi.comp AS comp_factura,
           COALESCE(t.nombre, pi.codigo) AS tipo_factura,
           pi.importe AS importe_aplicado,
           pi.detalle,
           pi.fecha AS fecha_aplicacion,
           pi.recibo AS recibo_origen,
           pi.parentpromoviid AS factura_promoviid,
           pf.fecha AS fac_fecha,
           pf.nombre AS fac_cliente,
           pf.cuit AS fac_cuit,
           (COALESCE(pf.neto,0)+COALESCE(pf.iva,0)+COALESCE(pf.percepcion,0)+COALESCE(pf.retencion,0)) AS fac_total,
           pf.neto AS fac_neto, pf.iva AS fac_iva, pf.percepcion AS fac_percepcion
    FROM proimpu pi
    LEFT JOIN tranparamcompras t ON pi.codigo = t.codigo
    LEFT JOIN promovi pf ON pf.promoviid = pi.parentpromoviid
    WHERE pi.parentreciboid = $1
       OR ($2 <> '' AND pi.parentopagoid = $2)
    ORDER BY pi.codigo, pi.comp, pi.importe, pi.fecha`,
    [promoviid, (pagosid || '').trim()]
  );
  return r.rows.map((row) => ({
    codigo_factura: row.codigo_factura,
    comp_factura: row.comp_factura,
    tipo_factura: row.tipo_factura,
    importe_aplicado: row.importe_aplicado,
    detalle: row.detalle,
    fecha_aplicacion: row.fecha_aplicacion,
    recibo_origen: row.recibo_origen,
    factura: row.fac_total != null ? {
      total: row.fac_total,
      neto: row.fac_neto,
      iva: row.fac_iva,
      percepcion: row.fac_percepcion,
      fecha: row.fac_fecha,
      cliente: row.fac_cliente,
      cuit: row.fac_cuit,
    } : null,
  }));
}

router.get('/ordenespago', async (req, res) => {
  try {
    const { search, desde, hasta, limit, offset } = req.query;
    // Listar RS (órdenes/recibos de pago a proveedores), no facturas FS
    let sql = `SELECT p.promoviid, p.clase, p.codigo, p.comp, p.fecha, p.fechaven,
               COALESCE(NULLIF(TRIM(p.nombre), ''), pr.nombre) AS nombre,
               COALESCE(NULLIF(TRIM(p.cuit), ''), pr.cuit) AS cuit,
               p.neto, p.iva, p.percepcion, p.retencion,
               (COALESCE(p.neto,0)+COALESCE(p.iva,0)+COALESCE(p.percepcion,0)+COALESCE(p.retencion,0)) as total,
               p.pago, p.moneda, p.estadoreg, p.proveedor, p.comprob, p.ordcomp,
               p.pagosid, p.nota,
               pg.detalle as pago_nombre
               FROM promovi p
               LEFT JOIN proveedo pr ON p.proveedor = pr.proveedor
               LEFT JOIN pagos pg ON p.pago = pg.pago
               WHERE p.codigo = 'RS' AND COALESCE(p.neto, 0) <> 0`;
    const conditions = []; const params = [];
    if (search) {
      conditions.push(`(p.comp::text ILIKE $${params.length+1} OR COALESCE(NULLIF(TRIM(p.nombre),''), pr.nombre) ILIKE $${params.length+1} OR p.proveedor ILIKE $${params.length+1} OR COALESCE(NULLIF(TRIM(p.cuit),''), pr.cuit) ILIKE $${params.length+1})`);
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
      SELECT p.*,
             pg.detalle as pago_nombre,
             COALESCE(NULLIF(TRIM(p.nombre), ''), pr.nombre) AS nombre,
             COALESCE(NULLIF(TRIM(p.cuit), ''), pr.cuit) AS cuit,
             pr.domicilio AS prov_domicilio,
             pr.localidad AS prov_localidad,
             pr.provincia AS prov_provincia
      FROM promovi p
      LEFT JOIN pagos pg ON p.pago = pg.pago
      LEFT JOIN proveedo pr ON p.proveedor = pr.proveedor
      WHERE p.promoviid = $1`, [id]);

    if (orden.rows.length === 0) return res.status(404).json({ error: 'Orden no encontrada' });

    const ord = orden.rows[0];
    const imputaciones = await queryImputacionesOrdenPago(id, ord.pagosid);
    const totalAplicado = imputaciones.reduce((s, r) => s + (parseFloat(r.importe_aplicado) || 0), 0);
    const medios = await queryMediosOrdenPago(id, ord.pagosid);

    res.json({
      orden: ord,
      imputaciones,
      total_orden: (parseFloat(ord.neto)||0) + (parseFloat(ord.iva)||0) + (parseFloat(ord.percepcion)||0) + (parseFloat(ord.retencion)||0),
      total_aplicado: totalAplicado,
      total_imputado: totalAplicado,
      medios_pago: medios.medios_pago,
      retenciones: medios.retenciones,
      resumen: medios.resumen
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
