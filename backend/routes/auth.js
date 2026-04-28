import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, runAsync, getAsync, allAsync } from '../models/db.js';
import { createToken } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/login
 * Majitelka se přihlásí emailem a heslem → dostane JWT.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, heslo } = req.body;
    if (!email || !heslo) {
      return res.status(400).json({ error: 'E-mail a heslo jsou povinné' });
    }

    const uzivatel = await getAsync(
      'SELECT * FROM uzivatele WHERE LOWER(email) = LOWER(?)',
      [email]
    );

    if (!uzivatel) {
      return res.status(401).json({ error: 'Nesprávný e-mail nebo heslo' });
    }

    // Ověření hesla – podpora bcryptu i legacy plain text
    let shoda = false;
    try {
      shoda = await bcrypt.compare(heslo, uzivatel.heslo_hash);
    } catch {
      // hash není validní bcrypt string – zkus plain text
    }
    if (!shoda && uzivatel.heslo_hash === heslo) {
      // Legacy plain text – zahashujeme a uložíme
      shoda = true;
      const hesloHash = await bcrypt.hash(heslo, 10);
      await runAsync('UPDATE uzivatele SET heslo_hash = ? WHERE id = ?', [hesloHash, uzivatel.id]);
      console.log(`Migrováno heslo uživatele ${uzivatel.email} na bcrypt`);
    }
    if (!shoda) {
      return res.status(401).json({ error: 'Nesprávný e-mail nebo heslo' });
    }

    const token = createToken(uzivatel);
    res.json({
      token,
      uzivatel: {
        id: uzivatel.id,
        email: uzivatel.email,
        jmeno: uzivatel.jmeno,
        role: uzivatel.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Chyba serveru při přihlášení' });
  }
});

/**
 * POST /api/auth/aktivace
 * Zákazník aktivuje účet pomocí tokenu z URL.
 * Nastaví si heslo a token se označí jako použitý.
 */
router.post('/aktivace', async (req, res) => {
  try {
    const { token, heslo } = req.body;
    if (!token || !heslo) {
      return res.status(400).json({ error: 'Token a heslo jsou povinné' });
    }

    const uzivatel = await getAsync(
      'SELECT * FROM uzivatele WHERE token = ? AND token_pouzit = 0',
      [token]
    );

    if (!uzivatel) {
      return res.status(401).json({ error: 'Neplatný nebo již použitý token' });
    }

    const hesloHash = await bcrypt.hash(heslo, 10);
    await runAsync(
      'UPDATE uzivatele SET heslo_hash = ?, token_pouzit = 1 WHERE id = ?',
      [hesloHash, uzivatel.id]
    );

    const jwtToken = createToken(uzivatel);
    // Vrátíme i čerstvá data
    const updated = await getAsync('SELECT * FROM uzivatele WHERE id = ?', [uzivatel.id]);

    res.json({
      token: jwtToken,
      uzivatel: {
        id: updated.id,
        email: updated.email,
        jmeno: updated.jmeno,
        role: updated.role,
      },
    });
  } catch (err) {
    console.error('Aktivace error:', err);
    res.status(500).json({ error: 'Chyba serveru při aktivaci' });
  }
});

/**
 * GET /api/auth/profil
 * Vrátí aktuálního přihlášeného uživatele (vyžaduje JWT).
 */
router.get('/profil', async (req, res) => {
  // authenticate middleware připojí req.uzivatel
  res.json({
    id: req.uzivatel.id,
    email: req.uzivatel.email,
    jmeno: req.uzivatel.jmeno,
    role: req.uzivatel.role,
  });
});

export default router;