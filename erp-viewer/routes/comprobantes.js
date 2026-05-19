const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const { search, desde, hasta, limit } = req.query;
    let sql = `
      SELECT m.moviid, m.clase, m.codigo, m.comp, m.fecha, m.clienteid,
             m.cliente, m.nombre, m.neto, m.iva, (COALESCE(m.neto,0)+COALESCE(m.iva,0)+COALESCE(m.exento,0)+COALESCE(m.percepcion,0)) as total,
             m.fechaven, m.estadodoc, m.vendedor, m.cuit,
             tc.descripcion as tipocomprobante,
             c.nombre as cli_nombre
      FROM movi m
      LEFT JOIN o_comprobantes tc ON m.codigo = tc.codigo
      LEFT JOIN clientes c ON m.clienteid = c.clienteid`;
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(`(m.comp::text ILIKE $${params.length + 1} OR m.nombre ILIKE $${params.length + 1} OR c.nombre ILIKE $${params.length + 1} OR m.cliente ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (desde) {
      conditions.push(`m.fecha >= $${params.length + 1}`);
      params.push(desde);
    }
    if (hasta) {
      conditions.push(`m.fecha <= $${params.length + 1}`);
      params.push(hasta);
    }
    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }
    sql += ` ORDER BY m.fecha DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit) || 500);

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tipos', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM o_comprobantes ORDER BY codigo');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT m.*, (COALESCE(m.neto,0)+COALESCE(m.iva,0)+COALESCE(m.exento,0)+COALESCE(m.percepcion,0)) as total,
             tc.descripcion as tipocomprobante,
             c.nombre as cli_nombre, c.cuit as cli_cuit, c.domicilio as cli_domicilio,
             c.localidad as cli_localidad
      FROM movi m
      LEFT JOIN o_comprobantes tc ON m.codigo = tc.codigo
      LEFT JOIN clientes c ON m.clienteid = c.clienteid
      WHERE m.moviid = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comprobante no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/detalle', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sv.*, s.detalle as art_detalle
      FROM stock_ve sv
      LEFT JOIN stock s ON sv.clave = s.clave AND sv.rubro = s.rubro
      WHERE sv.parentmoviid = $1
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
