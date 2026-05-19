const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/bancos', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM bancos ORDER BY codigo');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cuentas', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM cuentas ORDER BY cuenta');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/pagos', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM pagos ORDER BY pago');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/chequeras', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM chequeras ORDER BY banco, cuenta');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
