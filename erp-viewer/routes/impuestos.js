const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/percepciones', async (req, res) => {
  try {
    const r = await db.query(`SELECT pc.id, pc.label, pc.alicuota, pc.campo, pc.tipo, pc.modulo, pc.jurisdiccion, pc.padron,
      p.label as tipo_nombre FROM o_percep_config pc LEFT JOIN o_percep_tipo p ON pc.tipo = p.id
      ORDER BY pc.label`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/retenciones', async (req, res) => { try {
    const r = await db.query('SELECT id, label, campo, tipo, tipocampo, modulo, alicuotaprov FROM o_reten_config ORDER BY label');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/tramosiva', async (req, res) => { try {
    const r = await db.query('SELECT * FROM o_tramosiva ORDER BY codigo, id');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/tramosretencion', async (req, res) => { try {
    const r = await db.query('SELECT * FROM o_tramos_retencion ORDER BY codigo');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/ivare', async (req, res) => { try {
    const r = await db.query('SELECT * FROM ivare ORDER BY codigo');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/regiva', async (req, res) => { try {
    const r = await db.query('SELECT codigo, detalle, clase, civa, campoa1, regiva_arca FROM regiva ORDER BY codigo');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/taxs', async (req, res) => { try {
    const r = await db.query('SELECT id, titulo, habilitado, sumatotal, sumadescuento FROM taxs ORDER BY id');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/alicuotas', async (req, res) => { try {
    const r = await db.query('SELECT id, label, alicuota, campo, tiposujeto, percepmin FROM o_pr_alicuota ORDER BY label');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/padroncaba', async (req, res) => { try {
    const r = await db.query("SELECT cuit, detalle, fecha_carga, fecha_vig_desde, fecha_vig_hasta, alicuota1, alicuota2, alicuota3, alicuota4 FROM o_cabaea_padron WHERE cuit IS NOT NULL AND cuit != '' ORDER BY cuit LIMIT 500");
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/padronbsas', async (req, res) => { try {
    const r = await db.query('SELECT cuit, tipo, alicp, alicr, grupor, fecha_vig_desde, fecha_vig_hasta, marsujr FROM o_ibbsas_padron ORDER BY cuit LIMIT 500');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/logafip', async (req, res) => { try {
    const r = await db.query("SELECT id, detalle, tipodoc, puntovta, numero, estado, cae, fechacae, coddoc FROM o_logafip ORDER BY id DESC LIMIT 100");
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
