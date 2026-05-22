const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'fypc-secret-key-2024';

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Se requiere rol admin' });
  next();
}

module.exports = { auth, adminOnly, JWT_SECRET };
