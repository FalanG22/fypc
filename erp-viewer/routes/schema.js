const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/tables', async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT tablename, (SELECT COUNT(*) FROM pg_tables WHERE schemaname='public') as total FROM pg_tables WHERE schemaname='public'`;
    const params = [];
    if (search) {
      sql += ` AND tablename ILIKE $1`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY tablename`;
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tables/:name', async (req, res) => {
  try {
    const name = req.params.name;
    const cols = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`, [name]);
    const pks = await db.query(`
      SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary`, [name]);
    const count = await db.query(`SELECT COUNT(*) as cnt FROM "${name}"`);
    res.json({
      name,
      columns: cols.rows,
      primaryKey: pks.rows.map(r => r.attname),
      totalRecords: parseInt(count.rows[0].cnt)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tables/:name/data', async (req, res) => {
  try {
    const { name } = req.params;
    const { search, limit, offset, order, sort } = req.query;
    let where = '';
    const params = [];
    if (search) {
      const colInfo = await db.query(`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
        ORDER BY ordinal_position LIMIT 10`, [name]);
      const textCols = colInfo.rows.filter(c => c.data_type === 'character varying' || c.data_type === 'text' || c.data_type === 'citext');
      if (textCols.length > 0) {
        const conds = textCols.map((c, i) => `"${c.column_name}"::text ILIKE $${params.length + 1}`);
        params.push(`%${search}%`);
        where = ` WHERE (${conds.join(' OR ')})`;
      }
    }
    const safeLimit = Math.min(parseInt(limit) || 100, 1000);
    const safeOff = parseInt(offset) || 0;
    const orderBy = order ? `"${order.replace(/[^a-zA-Z0-9_]/g, '')}"` : '1';
    const sortDir = sort === 'desc' ? 'DESC' : 'ASC';
    const data = await db.query(`SELECT * FROM "${name}" ${where} ORDER BY ${orderBy} ${sortDir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, safeLimit, safeOff]);
    res.json({ rows: data.rows, total: data.rows.length, limit: safeLimit, offset: safeOff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
