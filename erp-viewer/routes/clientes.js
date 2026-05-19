const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT c.*, p.nombre as provnom, pa.detalle as pagodet
               FROM clientes c
               LEFT JOIN provin p ON c.provincia = p.codigo
               LEFT JOIN pagos pa ON c.pago = pa.pago`;
    const params = [];
    if (search) {
      sql += ` WHERE c.cliente ILIKE $1 OR c.nombre ILIKE $1 OR c.deno ILIKE $1 OR c.cuit ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY c.nombre LIMIT 200`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await db.query(`SELECT c.*, p.nombre as provnom, pa.detalle as pagodet
                                   FROM clientes c
                                   LEFT JOIN provin p ON c.provincia = p.codigo
                                   LEFT JOIN pagos pa ON c.pago = pa.pago
                                   WHERE c.clienteid = $1`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/comprobantes', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await db.query(`
      SELECT m.*, tc.descripcion as tipocomprobante
      FROM movi m
      LEFT JOIN o_comprobantes tc ON m.codigo = tc.codigo
      WHERE m.clienteid = $1
      ORDER BY m.fecha DESC LIMIT 500
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
