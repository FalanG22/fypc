const express = require('express');
const router = express.Router();
const db = require('../db');

const FACTURA_CODIGOS = ['F', 'FS', 'C', 'CS', 'DS', 'OS', '3', '3S', '4S'];
const RECIBO_CODIGOS = ['RS', 'CS', 'R'];
const FACTURA_IN = FACTURA_CODIGOS.map((c) => `'${c}'`).join(',');
const RECIBO_IN = RECIBO_CODIGOS.map((c) => `'${c}'`).join(',');

function yearBounds(anio) {
  const y = parseInt(anio, 10);
  if (!anio || Number.isNaN(y)) return null;
  return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
}

function addDateFilters(conditions, params, desde, hasta, col = 'm.fecha') {
  if (desde) {
    conditions.push(`${col} >= $${params.length + 1}`);
    params.push(desde);
  }
  if (hasta) {
    conditions.push(`${col} <= $${params.length + 1}`);
    params.push(hasta);
  }
}

const MEDIOS_PAGO_SQL = `
  SELECT DISTINCT ON (cm.cajamovid)
         cm.cajamovid, cm.fecha, cm.comp, cm.detalle, cm.tipo, ct.nombre AS tipo_nombre,
         ct.valortipo, ct.retencion AS tipo_es_retencion, cm.documento,
         cm.impentra, cm.impsale, cm.numero, cm.numcheque, cm.vence, cm.banco,
         b.nombre AS banco_nombre, cm.cuenta, cu.nombre AS cuenta_nombre, cm.caja,
         cm.transfier, cm.clearing, cm.c_baseimponible, cm.c_alicuotaret,
         cm.parentmoviid, cm.parentpromoviid, cm.parentpagoid, cm.tipointerno,
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
  WHERE 1=1`;

/** Quita la letra de clase del medio del ID Tango: CR...A000202 → CR...000202 */
function idSinClase(id) {
  const s = (id || '').trim();
  const m = s.match(/^([A-Z]{2})(\d+)([A-Z])(\d+)$/);
  return m ? `${m[1]}${m[2]}${m[4]}` : s;
}

function mediosCajaQuery(extraWhere, onlyActive = true) {
  const rev = onlyActive
    ? 'COALESCE(cm.reversion, 0) = 0'
    : 'COALESCE(cm.reversion, 0) <> 0';
  return `${MEDIOS_PAGO_SQL} AND ${rev} AND (${extraWhere}) ORDER BY cm.cajamovid, cm.fecha`;
}

async function queryMediosCaja(whereSql, params, onlyActive = true) {
  const r = await db.query(mediosCajaQuery(whereSql, onlyActive), params);
  return splitMediosRetenciones(r.rows);
}

/** Caja por parentpagoid / parentpromoviid. No usar comp suelto: choca con CH/CQ/CD. */
async function queryMediosCajaIds(ids, comps = [], onlyActive = true, { useComps = false } = {}) {
  const cleanIds = [...new Set(ids.map((x) => (x || '').trim()).filter(Boolean))];
  const cleanComps = useComps
    ? [...new Set(comps.map((x) => (x || '').trim()).filter(Boolean))]
    : [];
  if (!cleanIds.length && !cleanComps.length) {
    return splitMediosRetenciones([]);
  }
  const parts = [];
  const params = [];
  if (cleanIds.length) {
    params.push(cleanIds);
    parts.push(`cm.parentpagoid = ANY($${params.length}::text[])`);
    parts.push(`cm.parentpromoviid = ANY($${params.length}::text[])`);
  }
  if (cleanComps.length) {
    params.push(cleanComps);
    parts.push(`TRIM(cm.comp) = ANY($${params.length}::text[])`);
  }
  return queryMediosCaja(parts.join(' OR '), params, onlyActive);
}

/** Facturas imputadas a una OP (RS): en Tango cuelgan por parentreciboid / parentopagoid, no por parentpromoviid. */
async function queryImputacionesOrdenPago(promoviid, pagosid) {
  const r = await db.query(
    `
    SELECT DISTINCT ON (pi.codigo, pi.comp, pi.importe, pi.fecha)
           pi.codigo, pi.comp, pi.cuota, pi.fecha, pi.importe, pi.detalle, pi.recibo,
           pi.parentopagoid, pi.parentreciboid, pi.parentpromoviid AS factura_promoviid,
           pi.proveedor, pi.tipo, pi.descuento, pi.moneda,
           pr.nombre AS proveedor_nombre,
           t.nombre AS tipo_nombre,
           pf.promoviid AS fac_promoviid, pf.codigo AS fac_codigo, pf.comp AS fac_comp,
           pf.fecha AS fac_fecha, pf.fechaven AS fac_fechaven,
           pf.nombre AS fac_nombre, pf.cuit AS fac_cuit,
           pf.neto AS fac_neto, pf.iva AS fac_iva, pf.percepcion AS fac_percepcion,
           pf.clase AS fac_clase,
           (COALESCE(pf.neto,0)+COALESCE(pf.iva,0)+COALESCE(pf.percepcion,0)+COALESCE(pf.retencion,0)) AS fac_total
    FROM proimpu pi
    LEFT JOIN proveedo pr ON pi.proveedor = pr.proveedor
    LEFT JOIN tranparamcompras t ON pi.codigo = t.codigo
    LEFT JOIN promovi pf ON pf.promoviid = pi.parentpromoviid
    WHERE pi.parentreciboid = $1
       OR ($2 <> '' AND pi.parentopagoid = $2)
    ORDER BY pi.codigo, pi.comp, pi.importe, pi.fecha`,
    [promoviid, (pagosid || '').trim()]
  );
  return r.rows;
}

async function fetchAnalisisTesoreriaOrden(promoviid) {
  const head = await db.query(
    `SELECT p.promoviid, p.comp, p.pagosid, p.pago, p.reversion, p.codigo, p.nota, pg.detalle AS pago_nombre
     FROM promovi p
     LEFT JOIN pagos pg ON p.pago = pg.pago
     WHERE p.promoviid = $1`,
    [promoviid]
  );
  const empty = {
    medios_pago: [],
    retenciones: [],
    resumen: {},
    medios_vinculados: [],
    medios_reversados_caja: { medios_pago: [], retenciones: [], resumen: {} },
    vinculos_imputacion: [],
    condicion_pago: null,
    ids_tesoreria_buscados: [],
    diagnostico: [],
    nota_tesoreria: null,
    estado_tesoreria: 'sin_datos',
  };
  if (!head.rows.length) return empty;

  const orden = head.rows[0];
  const pagosId = (orden.pagosid || '').trim();
  const idAlt = idSinClase(promoviid);

  // En OP (RS) las facturas apuntan a la OP vía parentreciboid / parentopagoid
  const links = await db.query(
    `SELECT DISTINCT ON (parentopagoid, parentreciboid, recibo)
            parentopagoid, parentreciboid, recibo, parentpromoviid AS factura_id
     FROM proimpu
     WHERE parentreciboid = $1
        OR ($2 <> '' AND parentopagoid = $2)
        OR parentpromoviid = $1
     ORDER BY parentopagoid, parentreciboid, recibo`,
    [promoviid, pagosId]
  );

  const vinculos_imputacion = [];
  for (const link of links.rows) {
    const reciboId = (link.parentreciboid || '').trim();
    let reciboPromovi = null;
    if (reciboId) {
      const pr = await db.query(
        `SELECT promoviid, codigo, comp, fecha, neto, pago, pagosid, reversion, nota
         FROM promovi WHERE promoviid = $1`,
        [reciboId]
      );
      reciboPromovi = pr.rows[0] || null;
    }
    vinculos_imputacion.push({
      parentopagoid: (link.parentopagoid || '').trim(),
      parentreciboid: reciboId,
      recibo_comp: (link.recibo || '').trim(),
      factura_id: (link.factura_id || '').trim(),
      recibo_promovi: reciboPromovi,
    });
  }

  // Clave correcta de caja: pagosid (CP...). El parentpromoviid en cajamov suele ir SIN letra de clase.
  const ids = [promoviid, idAlt, pagosId].filter(Boolean);
  links.rows.forEach((l) => {
    if (l.parentopagoid) ids.push(l.parentopagoid.trim());
  });

  const ids_tesoreria_buscados = [...new Set(ids.filter(Boolean))];

  const [directo, todosReversados] = await Promise.all([
    queryMediosCajaIds(ids_tesoreria_buscados, [], true, { useComps: false }),
    queryMediosCajaIds(ids_tesoreria_buscados, [], false, { useComps: false }),
  ]);

  const condicion_pago = {
    codigo: orden.pago || null,
    detalle: orden.pago_nombre || null,
    pagosid: pagosId || null,
    es_condicion_comercial: true,
  };

  const diagnostico = [];
  if (Number(orden.reversion) === 1) {
    diagnostico.push(
      'Este comprobante está marcado como reversión (promovi.reversion = 1). Suele anular o corregir un pago anterior; no implica un egreso vigente en tesorería.'
    );
  }
  if (orden.nota && /reversi/i.test(orden.nota)) {
    diagnostico.push(`Nota del comprobante: ${orden.nota}`);
  }

  const hayCajaActiva = directo.medios_pago.length + directo.retenciones.length > 0;

  if (!hayCajaActiva && (orden.pago || orden.pago_nombre)) {
    diagnostico.push(
      `En cabecera figura condición/medio «${orden.pago_nombre || orden.pago}» (código ${orden.pago || '—'}), pero no hay líneas activas en cajamov para pagosid ${pagosId || '—'}.`
    );
  }
  if (!hayCajaActiva && todosReversados.medios_pago.length + todosReversados.retenciones.length > 0) {
    diagnostico.push(
      `Existen ${todosReversados.medios_pago.length + todosReversados.retenciones.length} línea(s) en cajamov marcadas como reversión.`
    );
  }

  diagnostico.push(
    `IDs consultados en cajamov (pagosid/promoviid, sin comp suelto): ${ids_tesoreria_buscados.join(', ') || '—'}.`
  );

  let estado_tesoreria = 'sin_datos';
  if (hayCajaActiva) estado_tesoreria = 'con_movimientos';
  else if (Number(orden.reversion) === 1) estado_tesoreria = 'reversado';
  else if (orden.pago || orden.pago_nombre) estado_tesoreria = 'solo_condicion';

  return {
    ...directo,
    medios_vinculados: [],
    medios_reversados_caja: todosReversados,
    vinculos_imputacion,
    condicion_pago,
    ids_tesoreria_buscados,
    comps_buscados: [],
    diagnostico,
    nota_tesoreria: null,
    estado_tesoreria,
  };
}

async function fetchMediosPorOrdenPago(promoviid) {
  return fetchAnalisisTesoreriaOrden(promoviid);
}

async function fetchMediosPorReciboMovi(moviid) {
  const r = await db.query(
    mediosCajaQuery(
      `cm.parentmoviid = $1
       OR cm.parentpromoviid IN (
         SELECT p.promoviid FROM promovi p
         INNER JOIN movi m ON m.moviid = $1 AND p.comp = m.comp AND p.codigo = m.codigo
       )`,
      true
    ),
    [moviid]
  );
  return splitMediosRetenciones(r.rows);
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
      total_retenido: retenciones.reduce((s, m) => s + (parseFloat(m.impsale) || parseFloat(m.impentra) || 0), 0),
    },
  };
}

function promoviRetencionesCabecera(p) {
  const items = [];
  const push = (label, val, alic, tipo) => {
    const n = parseFloat(val);
    if (!n) return;
    items.push({ concepto: label, importe: n, alicuota: alic, tipo_ret: tipo });
  };
  push('Retención (cabecera)', p.retencion, null, null);
  push('Percepción (cabecera)', p.percepcion, null, null);
  for (let i = 1; i <= 10; i++) push(`Impuesto aux. ${i}`, p[`tax${i}`], null, p[`tiporet${i}`]);
  for (let i = 1; i <= 5; i++) push(`Impuesto aux. prom. ${i}`, p[`impuestoaux${i}`], null, p[`tiporet${i}`]);
  return items;
}

router.get('/anios', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT y FROM (
        SELECT DISTINCT EXTRACT(YEAR FROM fecha)::int AS y FROM movi
          WHERE codigo IN (${FACTURA_IN}) OR codigo IN (${RECIBO_IN})
        UNION
        SELECT DISTINCT EXTRACT(YEAR FROM fecha)::int FROM promovi p
          WHERE EXISTS (SELECT 1 FROM proimpu pi WHERE pi.parentpromoviid = p.promoviid)
        UNION
        SELECT DISTINCT EXTRACT(YEAR FROM fecha)::int FROM imputaciones WHERE fecha IS NOT NULL
      ) t WHERE y IS NOT NULL ORDER BY y DESC`);
    res.json(r.rows.map((row) => row.y));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/facturas-venta', async (req, res) => {
  try {
    const { search, anio, desde, hasta, limit, offset } = req.query;
    const yr = yearBounds(anio);
    const d0 = yr?.desde || desde;
    const h0 = yr?.hasta || hasta;

    let sql = `
      SELECT m.moviid, m.clase, m.codigo, m.comp, m.fecha, m.fechaven,
             m.clienteid, m.cliente, m.nombre, m.cuit,
             m.neto, m.iva, m.exento, m.percepcion,
             (COALESCE(m.neto,0)+COALESCE(m.iva,0)+COALESCE(m.exento,0)+COALESCE(m.percepcion,0)) AS total,
             m.vendedor, m.pago, m.estadodoc, m.campocae AS cae, m.campofechacae AS fechacae,
             tc.descripcion AS tipocomprobante,
             COALESCE(imp.cobrado, 0) AS cobrado,
             COALESCE(imp.cant_aplic, 0) AS cant_aplicaciones
      FROM movi m
      LEFT JOIN o_comprobantes tc ON m.codigo = tc.codigo
      LEFT JOIN (
        SELECT moviid,
               SUM(importe) AS cobrado,
               COUNT(*) FILTER (WHERE detalle = 'Cobranza') AS cant_aplic
        FROM imputaciones
        GROUP BY moviid
      ) imp ON imp.moviid = m.moviid
      WHERE m.codigo IN (${FACTURA_IN})`;

    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(
        `(m.comp::text ILIKE $${params.length + 1} OR m.nombre ILIKE $${params.length + 1} OR m.cliente ILIKE $${params.length + 1} OR m.cuit ILIKE $${params.length + 1})`
      );
      params.push(`%${search}%`);
    }
    addDateFilters(conditions, params, d0, h0);
    if (conditions.length) sql += ` AND ${conditions.join(' AND ')}`;
    sql += ` ORDER BY m.fecha DESC, m.comp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10) || 500, parseInt(offset, 10) || 0);

    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/recibos-venta', async (req, res) => {
  try {
    const { search, anio, desde, hasta, limit, offset } = req.query;
    const yr = yearBounds(anio);
    const d0 = yr?.desde || desde;
    const h0 = yr?.hasta || hasta;

    let sql = `
      SELECT m.moviid, m.codigo, m.clase, m.comp, m.fecha, m.fechaven,
             m.clienteid, m.cliente, m.nombre, m.cuit, m.neto, m.iva,
             (COALESCE(m.neto,0)+COALESCE(m.iva,0)) AS total,
             m.pago, pg.detalle AS pago_nombre, m.estadodoc, m.cobrador,
             COALESCE(imp.aplicado, 0) AS aplicado,
             COALESCE(imp.cant_fac, 0) AS cant_facturas
      FROM movi m
      LEFT JOIN pagos pg ON m.pago = pg.pago
      LEFT JOIN (
        SELECT parentmoviid,
               SUM(importe) AS aplicado,
               COUNT(*) FILTER (WHERE detalle = 'Cobranza') AS cant_fac
        FROM imputaciones
        GROUP BY parentmoviid
      ) imp ON imp.parentmoviid = m.moviid
      WHERE m.codigo IN (${RECIBO_IN})`;

    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(
        `(m.comp::text ILIKE $${params.length + 1} OR m.nombre ILIKE $${params.length + 1} OR m.cliente ILIKE $${params.length + 1} OR m.cuit ILIKE $${params.length + 1})`
      );
      params.push(`%${search}%`);
    }
    addDateFilters(conditions, params, d0, h0);
    if (conditions.length) sql += ` AND ${conditions.join(' AND ')}`;
    sql += ` ORDER BY m.fecha DESC, m.comp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10) || 500, parseInt(offset, 10) || 0);

    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ordenes-pago', async (req, res) => {
  try {
    const { search, anio, desde, hasta, limit, offset } = req.query;
    const yr = yearBounds(anio);
    const d0 = yr?.desde || desde;
    const h0 = yr?.hasta || hasta;

    // Órdenes de pago = promovi RS. Las facturas imputadas apuntan a la OP
    // por parentreciboid / parentopagoid (no parentpromoviid = OP).
    let sql = `
      SELECT p.promoviid, p.clase, p.codigo, p.comp, p.fecha, p.fechaven,
             COALESCE(NULLIF(TRIM(p.nombre), ''), pr.nombre) AS nombre,
             COALESCE(NULLIF(TRIM(p.cuit), ''), pr.cuit) AS cuit,
             p.proveedor, p.neto, p.iva, p.percepcion, p.retencion,
             (COALESCE(p.neto,0)+COALESCE(p.iva,0)+COALESCE(p.percepcion,0)+COALESCE(p.retencion,0)) AS total,
             p.pago, pg.detalle AS pago_nombre, p.estadoreg, p.comprob, p.nota, p.reversion,
             p.pagosid,
             COALESCE(pi.cnt, 0) AS lineas_imputacion,
             COALESCE(pi.aplicado, 0) AS total_imputado
      FROM promovi p
      LEFT JOIN proveedo pr ON p.proveedor = pr.proveedor
      LEFT JOIN pagos pg ON p.pago = pg.pago
      LEFT JOIN (
        SELECT parentreciboid AS op_id,
               COUNT(*)::int AS cnt,
               SUM(importe) AS aplicado
        FROM (
          SELECT DISTINCT ON (parentreciboid, codigo, comp, importe, fecha)
                 parentreciboid, importe
          FROM proimpu
          WHERE parentreciboid IS NOT NULL AND TRIM(parentreciboid) <> ''
          ORDER BY parentreciboid, codigo, comp, importe, fecha
        ) ded
        GROUP BY parentreciboid
      ) pi ON pi.op_id = p.promoviid
      WHERE p.codigo = 'RS'
        AND COALESCE(p.neto, 0) <> 0`;

    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(
        `(p.comp::text ILIKE $${params.length + 1}
          OR COALESCE(NULLIF(TRIM(p.nombre), ''), pr.nombre) ILIKE $${params.length + 1}
          OR p.proveedor ILIKE $${params.length + 1}
          OR COALESCE(NULLIF(TRIM(p.cuit), ''), pr.cuit) ILIKE $${params.length + 1})`
      );
      params.push(`%${search}%`);
    }
    addDateFilters(conditions, params, d0, h0, 'p.fecha');
    if (conditions.length) sql += ` AND ${conditions.join(' AND ')}`;
    sql += ` ORDER BY p.fecha DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10) || 500, parseInt(offset, 10) || 0);

    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/facturas-venta/:moviid', async (req, res) => {
  try {
    const { moviid } = req.params;
    const cab = await db.query(
      `
      SELECT m.*,
             (COALESCE(m.neto,0)+COALESCE(m.iva,0)+COALESCE(m.exento,0)+COALESCE(m.percepcion,0)) AS total,
             tc.descripcion AS tipocomprobante,
             v.nom_ven AS vendedor_nombre,
             pg.detalle AS pago_nombre
      FROM movi m
      LEFT JOIN o_comprobantes tc ON m.codigo = tc.codigo
      LEFT JOIN vendedor v ON m.vendedor = v.vendedor
      LEFT JOIN pagos pg ON m.pago = pg.pago
      WHERE m.moviid = $1`,
      [moviid]
    );
    if (!cab.rows.length) return res.status(404).json({ error: 'Factura no encontrada' });

    const [lineas, cobranzas] = await Promise.all([
      db.query(
        `
        SELECT sv.clave, s.detalle AS art_detalle, s.codbar, sv.cantidad, sv.precio,
               (sv.cantidad * sv.precio) AS subtotal, sv.descuento, sv.iva, sv.lote
        FROM stock_ve sv
        LEFT JOIN stock s ON sv.stockid = s.stockid
        WHERE sv.parentmoviid = $1
        ORDER BY sv.regid`,
        [moviid]
      ),
      db.query(
        `
        SELECT i.id, i.fecha, i.importe, i.detalle, i.ajustamoneda,
               r.moviid AS recibo_moviid, r.codigo AS recibo_codigo, r.comp AS recibo_comp,
               r.fecha AS recibo_fecha, r.nombre AS recibo_cliente, r.neto AS recibo_neto
        FROM imputaciones i
        LEFT JOIN movi r ON r.moviid = i.parentmoviid
        WHERE i.moviid = $1
        ORDER BY i.fecha, i.id`,
        [moviid]
      ),
    ]);

    const cobrado = cobranzas.rows.reduce((s, r) => s + (parseFloat(r.importe) || 0), 0);

    const reciboIds = [...new Set(cobranzas.rows.map((r) => r.recibo_moviid).filter(Boolean))];
    const mediosPorRecibo = {};
    await Promise.all(
      reciboIds.map(async (rid) => {
        mediosPorRecibo[rid] = await fetchMediosPorReciboMovi(rid);
      })
    );

    res.json({
      comprobante: cab.rows[0],
      lineas: lineas.rows,
      cobranzas: cobranzas.rows,
      medios_por_recibo: mediosPorRecibo,
      total_cobrado: cobrado,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/recibos-venta/:moviid', async (req, res) => {
  try {
    const { moviid } = req.params;
    const cab = await db.query(
      `
      SELECT m.*, (COALESCE(m.neto,0)+COALESCE(m.iva,0)) AS total,
             pg.detalle AS pago_nombre, tc.descripcion AS tipocomprobante
      FROM movi m
      LEFT JOIN pagos pg ON m.pago = pg.pago
      LEFT JOIN o_comprobantes tc ON m.codigo = tc.codigo
      WHERE m.moviid = $1`,
      [moviid]
    );
    if (!cab.rows.length) return res.status(404).json({ error: 'Recibo no encontrado' });

    const [aplicaciones, promoviRows] = await Promise.all([
      db.query(
        `
        SELECT i.id, i.fecha, i.importe, i.detalle,
               f.moviid AS factura_moviid, f.codigo AS factura_codigo, f.comp AS factura_comp,
               f.fecha AS factura_fecha, f.nombre AS factura_cliente,
               (COALESCE(f.neto,0)+COALESCE(f.iva,0)+COALESCE(f.exento,0)+COALESCE(f.percepcion,0)) AS factura_total,
               f.campocae AS factura_cae
        FROM imputaciones i
        LEFT JOIN movi f ON f.moviid = i.moviid
        WHERE i.parentmoviid = $1
        ORDER BY i.fecha, i.id`,
        [moviid]
      ),
      db.query(
        `
        SELECT p.*
        FROM promovi p
        INNER JOIN movi m ON m.moviid = $1
        WHERE p.comp = m.comp AND p.codigo = m.codigo
        LIMIT 5`,
        [moviid]
      ),
    ]);

    const medios = await fetchMediosPorReciboMovi(moviid);
    const retenciones_cabecera = promoviRows.rows.flatMap((p) => promoviRetencionesCabecera(p));

    res.json({
      comprobante: cab.rows[0],
      aplicaciones: aplicaciones.rows,
      promovi_tesoreria: promoviRows.rows,
      ...medios,
      retenciones_cabecera,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ordenes-pago/:promoviid', async (req, res) => {
  try {
    const { promoviid } = req.params;

    const orden = await db.query(
      `
      SELECT p.*,
             pg.detalle AS pago_nombre,
             COALESCE(NULLIF(TRIM(p.nombre), ''), pr.nombre) AS nombre,
             COALESCE(NULLIF(TRIM(p.cuit), ''), pr.cuit) AS cuit,
             pr.domicilio AS prov_domicilio,
             pr.localidad AS prov_localidad,
             pr.provincia AS prov_provincia
      FROM promovi p
      LEFT JOIN pagos pg ON p.pago = pg.pago
      LEFT JOIN proveedo pr ON p.proveedor = pr.proveedor
      WHERE p.promoviid = $1`,
      [promoviid]
    );
    if (!orden.rows.length) return res.status(404).json({ error: 'Orden / comprobante de pago no encontrado' });

    const ord = orden.rows[0];
    const pagosId = (ord.pagosid || '').trim();
    const impRows = await queryImputacionesOrdenPago(promoviid, pagosId);
    const medios = await fetchAnalisisTesoreriaOrden(promoviid);
    const retenciones_cabecera = promoviRetencionesCabecera(ord);

    const valorIds = [...(medios.ids_tesoreria_buscados || []), promoviid];
    const valores = await db.query(
      `
      SELECT pv.tipo, pv.importe, pv.banco, pv.numero, pv.vence, pv.cajadet, pv.caja, pv.esreten,
             b.nombre AS banco_nombre, pv.idelement, pv.num_op
      FROM pagosimpvalores pv
      LEFT JOIN bancos b ON pv.banco = b.codigo
      WHERE pv.idelement = ANY($1::text[])
      ORDER BY pv.vence NULLS LAST`,
      [valorIds]
    );

    const comp = await db.query(
      `
      SELECT pic.id, pic.fecha, pic.comp, pic.totcomp, pic.totsaldo, pic.cancela, pic.cuota, pic.fechaven, pic.detalle
      FROM pagosimpcomp pic
      WHERE pic.pagoid = $1 OR pic.idelement = $1 OR ($2 <> '' AND pic.pagoid = $2)
      ORDER BY pic.fecha`,
      [promoviid, pagosId]
    );

    const totalOrden =
      (parseFloat(ord.neto) || 0) +
      (parseFloat(ord.iva) || 0) +
      (parseFloat(ord.percepcion) || 0) +
      (parseFloat(ord.retencion) || 0);
    const totalImputado = impRows.reduce((s, r) => s + (parseFloat(r.importe) || 0), 0);

    res.json({
      orden: ord,
      imputaciones: impRows,
      valores: valores.rows,
      aplicaciones_ctacte: comp.rows,
      ...medios,
      retenciones_cabecera,
      total_orden: totalOrden,
      total_imputado: totalImputado,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
