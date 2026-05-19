const express = require('express');
const router = express.Router();
const db = require('../db');

const simpleQueries = {
  'camiones': 'SELECT * FROM camiones ORDER BY patente',
  'choferes': 'SELECT * FROM choferes ORDER BY nombre',
  'lineas': 'SELECT * FROM lineas ORDER BY codigo',
  'familias': 'SELECT * FROM familias ORDER BY codigo',
  'grupos': 'SELECT * FROM grupos ORDER BY codigo',
  'marcas': 'SELECT * FROM o_marcas ORDER BY detalle',
  'choferes': 'SELECT * FROM choferes ORDER BY nombre',
  'monedas': 'SELECT * FROM monedas ORDER BY codigo',
  'paises': 'SELECT * FROM paises ORDER BY nombre',
  'unidades': 'SELECT * FROM unidad ORDER BY codigo',
  'vendedores': 'SELECT * FROM vendedor ORDER BY nom_ven',
  'cobradores': 'SELECT * FROM cobrador ORDER BY nombre',
  'motivos': 'SELECT * FROM motivos ORDER BY codigo',
  'motivosstock': 'SELECT * FROM motsto ORDER BY codigo',
  'categoriasstock': 'SELECT * FROM stockcategoria ORDER BY codigo',
  'conciliacion': 'SELECT * FROM resumenbanco ORDER BY fecha DESC LIMIT 500',
  'cajas': 'SELECT * FROM cajatipo ORDER BY codigo',
  'tipocomprobantes': 'SELECT * FROM o_comprobantes ORDER BY codigo',
  'condicionesiva': 'SELECT * FROM taxcondpro ORDER BY id',
  'contactos': 'SELECT co.*, c.nombre as cliente_nombre FROM contacto co LEFT JOIN clientes c ON co.clienteid = c.clienteid ORDER BY co.nombre LIMIT 500',
  'contactogrupos': 'SELECT * FROM contactogrupos ORDER BY nombre',
  'archivos': 'SELECT * FROM archivosadjuntos ORDER BY fecha DESC LIMIT 200',
  'proformas': 'SELECT * FROM memoform ORDER BY id DESC LIMIT 200',
  'carpetas': 'SELECT * FROM carpetas ORDER BY nombre',
  'presupuestos': 'SELECT * FROM proyecciones ORDER BY id DESC LIMIT 200',
  'evaluaciones': 'SELECT ev.*, e.nombre as evaluado_nombre FROM ev_evaluaciones ev LEFT JOIN s_empleados e ON ev.evaluadoid = e.id ORDER BY ev.fecha DESC LIMIT 200',
};

router.get('/:section', async (req, res) => {
  const { section } = req.params;
  const query = simpleQueries[section];
  if (!query) return res.status(404).json({ error: `Seccion '${section}' no encontrada` });
  try {
    const r = await db.query(query);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
