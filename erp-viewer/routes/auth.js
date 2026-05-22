const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { auth, adminOnly, JWT_SECRET } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  try {
    const r = await db.query(
      'SELECT * FROM usuarios WHERE username = $1 AND activo = true',
      [username]
    );
    if (r.rows.length === 0)
      return res.status(401).json({ error: 'Credenciales inválidas' });
    const user = r.rows[0];
    if (!(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Credenciales inválidas' });
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, nombre: user.nombre },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, nombre: user.nombre },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT id, username, role, nombre, activo, created_at FROM usuarios WHERE id = $1',
      [req.user.id]
    );
    if (r.rows.length === 0)
      return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT id, username, role, nombre, activo, created_at FROM usuarios ORDER BY id'
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/users', auth, adminOnly, async (req, res) => {
  const { username, password, role, nombre } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await db.query(
      'INSERT INTO usuarios (username, password, role, nombre) VALUES ($1,$2,$3,$4) RETURNING id, username, role, nombre, activo, created_at',
      [username, hash, role || 'user', nombre || username]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505')
      return res.status(400).json({ error: 'El usuario ya existe' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/users/:id', auth, adminOnly, async (req, res) => {
  const { username, password, role, nombre, activo } = req.body;
  try {
    const sets = [];
    const params = [];
    if (username !== undefined) { sets.push(`username = $${params.length+1}`); params.push(username); }
    if (role !== undefined) { sets.push(`role = $${params.length+1}`); params.push(role); }
    if (nombre !== undefined) { sets.push(`nombre = $${params.length+1}`); params.push(nombre); }
    if (activo !== undefined) { sets.push(`activo = $${params.length+1}`); params.push(activo); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      sets.push(`password = $${params.length+1}`); params.push(hash);
    }
    if (sets.length === 0)
      return res.status(400).json({ error: 'Sin campos para actualizar' });
    params.push(req.params.id);
    const r = await db.query(
      `UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id, username, role, nombre, activo, created_at`,
      params
    );
    if (r.rows.length === 0)
      return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const r = await db.query(
      'DELETE FROM usuarios WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (r.rows.length === 0)
      return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Usuario eliminado' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
