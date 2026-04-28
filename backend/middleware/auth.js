import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Ověří JWT token z Authorization headeru.
 * Na req připojí: req.uzivatel = { id, email, jmeno, role }
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chybí autorizační token' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.uzivatel = {
      id: decoded.id,
      email: decoded.email,
      jmeno: decoded.jmeno,
      role: decoded.role,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Neplatný nebo expirovaný token' });
  }
}

/**
 * Vytvoří JWT token pro daného uživatele (platnost 7 dní).
 */
export function createToken(uzivatel) {
  return jwt.sign(
    { id: uzivatel.id, email: uzivatel.email, jmeno: uzivatel.jmeno, role: uzivatel.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Middleware – povolí přístup jen majitelce.
 * Použít až za authenticate().
 */
export function requireMajitel(req, res, next) {
  if (req.uzivatel?.role !== 'majitel') {
    return res.status(403).json({ error: 'Přístup pouze pro majitelku' });
  }
  next();
}