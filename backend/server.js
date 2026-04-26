import 'dotenv/config';
import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import multer from 'multer';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';
import { generateFakturaPdf } from './pdf-generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const dbPath = join(__dirname, 'data', 'nela.db');
const dataDir = join(__dirname, 'data');
const projektyDir = join(dataDir, 'projekty');
const db = new sqlite3.Database(dbPath);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Adresáře ──────────────────────────────────────────────
if (!existsSync(projektyDir)) mkdirSync(projektyDir, { recursive: true });

// ── Multer: upload souborů ────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const zakazkaId = req.params.id || 'orphan';
    const dir = join(projektyDir, zakazkaId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now().toString(36) + '_' + safe);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ── DB: tabulky + migrace ─────────────────────────────────
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS uzivatele (
    id TEXT PRIMARY KEY, email TEXT, jmeno TEXT, role TEXT,
    heslo_hash TEXT, token TEXT, token_pouzit INTEGER, datum_vytvoreni TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS polozka_historie (id INTEGER PRIMARY KEY AUTOINCREMENT, typ TEXT CHECK(typ IN ('kategorie', 'nazev')), hodnota TEXT NOT NULL, datum TEXT NOT NULL, puvod TEXT CHECK(puvod IN ('system', 'uzivatel')), UNIQUE(typ, hodnota))`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_polozka_historie_datum ON polozka_historie (datum)`);

  db.run(`CREATE TABLE IF NOT EXISTS zakazky (
    id TEXT PRIMARY KEY, data TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS zpravy (
    id TEXT PRIMARY KEY, zakazka_id TEXT, autor_id TEXT,
    autor_jmeno TEXT DEFAULT '', autor_role TEXT DEFAULT '',
    text TEXT DEFAULT '', prilohy TEXT DEFAULT '[]',
    datum TEXT, precteno INTEGER DEFAULT 0,
    stitek TEXT DEFAULT NULL, pinned INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS soubory (
    id TEXT PRIMARY KEY, zakazka_id TEXT,
    nazev TEXT, typ TEXT, velikost INTEGER,
    stitek TEXT DEFAULT NULL, cesta TEXT,
    datum_nahrani TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS faktury (
    id TEXT PRIMARY KEY,
    cislo TEXT UNIQUE NOT NULL,
    zakazka_id TEXT NOT NULL,
    typ TEXT NOT NULL CHECK(typ IN ('zalohova', 'konecna', 'dobropis')),
    stav TEXT NOT NULL DEFAULT 'vystavena' CHECK(stav IN ('vystavena', 'odeslana', 'zaplacena', 'stornovana')),
    datum_vystaveni TEXT NOT NULL,
    datum_splatnosti TEXT NOT NULL,
    datum_zaplaceni TEXT,
    variabilni_symbol TEXT,
    castka_celkem REAL NOT NULL DEFAULT 0,
    poznamka TEXT DEFAULT '',
    dodavatel TEXT DEFAULT '{}',
    odberatel TEXT DEFAULT '{}',
    polozky TEXT DEFAULT '[]',
    datum_vytvoreni TEXT NOT NULL,
    datum_aktualizace TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ciselna_rada (
    rok INTEGER PRIMARY KEY,
    posledni_cislo INTEGER DEFAULT 0
  )`);

  // Migrace: přidání chybějících sloupců do staré tabulky zpravy
  const migCols = [
    'autor_jmeno TEXT DEFAULT \'\'',
    'autor_role TEXT DEFAULT \'\'',
    'prilohy TEXT DEFAULT \'[]\'',
    'precteno INTEGER DEFAULT 0',
    'stitek TEXT DEFAULT NULL',
    'pinned INTEGER DEFAULT 0',
  ];
  migCols.forEach(col => {
    db.run(`ALTER TABLE zpravy ADD COLUMN ${col}`, () => {});
  });

  // Seed: výchozí admin
  db.get("SELECT COUNT(*) as cnt FROM uzivatele", [], (err, row) => {
    if (!err && row.cnt === 0) {
      db.run(
        "INSERT INTO uzivatele (id,email,jmeno,role,heslo_hash,token_pouzit,datum_vytvoreni) VALUES (?,?,?,?,?,?,?)",
        ['nela1', 'nela@zahradnice.cz', 'Nela', 'majitel', 'nela2024', 1, new Date().toISOString()]
      );
      console.log('Seed: vytvořen výchozí uživatel nela@zahradnice.cz');
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS parametry (id TEXT PRIMARY KEY, typ TEXT, data TEXT)`, (err) => {
    if (!err) {
      db.get("SELECT COUNT(*) as cnt FROM parametry", [], (e, row) => {
        if (!e && row.cnt === 0) {
          db.all("SELECT typ, hodnota FROM polozka_historie", [], (e2, rows) => {
            if (!e2 && rows.length > 0) {
              const stmt = db.prepare("INSERT OR IGNORE INTO parametry (id, typ, data) VALUES (?, ?, ?)");
              rows.forEach(r => {
                stmt.run(`${r.typ}_${r.hodnota}`, r.typ, JSON.stringify({ hodnota: r.hodnota }));
              });
              stmt.finalize();
              console.log(`Seed: vloženo ${rows.length} parametrů z polozka_historie`);
            }
          });
        }
      });
    }
  });
});



// ── Parametry ──────────────────────────────────────────────
app.get('/api/parametry', (req, res) => {
  db.all("SELECT * FROM parametry", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ id: r.id, typ: r.typ, ...JSON.parse(r.data) })));
  });
});

app.get('/api/parametry/:typ', (req, res) => {
  db.all("SELECT * FROM parametry WHERE typ = ?", [req.params.typ], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ id: r.id, typ: r.typ, ...JSON.parse(r.data) })));
  });
});

app.post('/api/parametry', (req, res) => {
  const { id, typ, ...data } = req.body;
  if (!id || !typ) return res.status(400).json({ error: 'Missing id or typ' });

  db.run("INSERT OR REPLACE INTO parametry (id, typ, data) VALUES (?, ?, ?)",
    [id, typ, JSON.stringify(data)],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.sendStatus(200);
    }
  );
});

app.delete('/api/parametry/:id', (req, res) => {
  db.run("DELETE FROM parametry WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.sendStatus(200);
  });
});

// ── Uživatelé ─────────────────────────────────────────────
app.get('/api/uzivatele', (req, res) => {
  db.all("SELECT * FROM uzivatele", [], (err, rows) => res.json(rows));
});

app.post('/api/uzivatele', (req, res) => {
  const { id, email, jmeno, role, heslo_hash, token, token_pouzit, datum_vytvoreni } = req.body;
  db.run(
    "INSERT OR REPLACE INTO uzivatele VALUES (?,?,?,?,?,?,?,?)",
    [id, email, jmeno, role, heslo_hash, token, token_pouzit ? 1 : 0, datum_vytvoreni],
    () => res.sendStatus(200)
  );
});

// ── Zakázky ───────────────────────────────────────────────
app.get('/api/zakazky', (req, res) => {
  db.all("SELECT * FROM zakazky", [], (err, rows) => res.json(rows.map(r => JSON.parse(r.data))));
});

app.post('/api/zakazky', (req, res) => {
  const { id } = req.body;
  db.run("INSERT OR REPLACE INTO zakazky VALUES (?,?)", [id, JSON.stringify(req.body)], () => res.sendStatus(200));
});

app.delete('/api/zakazky/:id', (req, res) => {
  db.run("DELETE FROM zakazky WHERE id = ?", [req.params.id], () => res.sendStatus(200));
});

// ── Historie položek (našeptávač) ────────────────────────
app.get('/api/history/:type', (req, res) => {
  const { type } = req.params;
  const { q } = req.query;
  
  if (!['kategorie', 'nazev'].includes(type)) {
    return res.status(400).json({ error: 'Neplatný typ historie' });
  }

  let query = `SELECT hodnota FROM polozka_historie WHERE typ = ?`;
  const params = [type];

  if (q) {
    query += ` AND hodnota LIKE ?`;
    params.push(`${q}%`);
  }

  query += ` ORDER BY datum DESC LIMIT 5`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => r.hodnota));
  });
});

app.post('/api/history', (req, res) => {
  console.log('Ukládám do historie:', req.body);
  const { type, value } = req.body;

  if (!type || !value || !['kategorie', 'nazev'].includes(type)) {
    return res.status(400).json({ error: 'Chybí typ nebo hodnota' });
  }

  const stmt = `INSERT INTO polozka_historie (typ, hodnota, datum, puvod) VALUES (?, ?, ?, 'uzivatel') ON CONFLICT(typ, hodnota) DO UPDATE SET datum=excluded.datum`;
  db.run(stmt, [type, value, new Date().toISOString()], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.sendStatus(201);
  });
});

// ── Zprávy ────────────────────────────────────────────────
app.get('/api/zpravy/:zakazka_id', (req, res) => {
  db.all(
    "SELECT * FROM zpravy WHERE zakazka_id = ? ORDER BY pinned DESC, datum ASC",
    [req.params.zakazka_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => ({
        ...r,
        prilohy: JSON.parse(r.prilohy || '[]'),
        precteno: !!r.precteno,
        pinned: !!r.pinned,
      })));
    }
  );
});

app.post('/api/zpravy', (req, res) => {
  const { id, zakazka_id, autor_id, autor_jmeno, autor_role, text, prilohy, datum, stitek, pinned } = req.body;
  db.run(
    `INSERT OR REPLACE INTO zpravy
      (id, zakazka_id, autor_id, autor_jmeno, autor_role, text, prilohy, datum, precteno, stitek, pinned)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, zakazka_id, autor_id, autor_jmeno || '', autor_role || '', text || '',
     JSON.stringify(prilohy || []), datum, 0, stitek || null, pinned ? 1 : 0],
    err => err ? res.status(500).json({ error: err.message }) : res.sendStatus(200)
  );
});

app.patch('/api/zpravy/:id', (req, res) => {
  const { stitek, pinned, precteno } = req.body;
  const sets = [];
  const vals = [];
  if (stitek !== undefined) { sets.push('stitek = ?'); vals.push(stitek); }
  if (pinned !== undefined) { sets.push('pinned = ?'); vals.push(pinned ? 1 : 0); }
  if (precteno !== undefined) { sets.push('precteno = ?'); vals.push(precteno ? 1 : 0); }
  if (!sets.length) return res.sendStatus(400);
  vals.push(req.params.id);
  db.run(`UPDATE zpravy SET ${sets.join(', ')} WHERE id = ?`, vals,
    err => err ? res.status(500).json({ error: err.message }) : res.sendStatus(200)
  );
});

app.delete('/api/zpravy/:id', (req, res) => {
  db.run("DELETE FROM zpravy WHERE id = ?", [req.params.id], () => res.sendStatus(200));
});

// ── Projektové soubory ────────────────────────────────────
app.get('/api/zakazky/:id/soubory', (req, res) => {
  db.all(
    "SELECT * FROM soubory WHERE zakazka_id = ? ORDER BY datum_nahrani DESC",
    [req.params.id], (err, rows) => err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.post('/api/zakazky/:id/soubory', upload.array('soubory'), (req, res) => {
  const { id: zakazka_id } = req.params;
  const { stitek } = req.body;
  const stmt = db.prepare("INSERT INTO soubory VALUES (?,?,?,?,?,?,?,?)");
  (req.files || []).forEach(f => stmt.run(
    [f.filename, zakazka_id, f.originalname, f.mimetype, f.size, stitek, f.path, new Date().toISOString()]
  ));
  stmt.finalize(err => err ? res.status(500).json({ error: err.message }) : res.sendStatus(201));
});

app.get('/api/soubory/:id', (req, res) => {
  db.get("SELECT * FROM soubory WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).send('Soubor nenalezen');
    // cesta může být relativní k server.js; uděláme absolutní
    const absolutePath = join(__dirname, row.cesta.startsWith('/') ? row.cesta.slice(1) : row.cesta);
    res.sendFile(absolutePath);
  });
});

app.delete('/api/soubory/:id', (req, res) => {
  db.get("SELECT cesta FROM soubory WHERE id = ?", [req.params.id], (err, row) => {
    if (err || !row) return; // Chybu nehlásíme, prostě soubor asi neexistuje
    if (existsSync(row.cesta)) unlinkSync(row.cesta);
    db.run("DELETE FROM soubory WHERE id = ?", [req.params.id]);
  });
  res.sendStatus(200);
});

// ── Číselná řada faktur ───────────────────────────────────
function dalsiCisloFaktury() {
  return new Promise((resolve, reject) => {
    const rok = new Date().getFullYear();
    db.get('SELECT posledni_cislo FROM ciselna_rada WHERE rok = ?', [rok], (err, row) => {
      if (err) return reject(err);
      const dalsi = (row?.posledni_cislo || 0) + 1;
      const cislo = `${rok}${String(dalsi).padStart(4, '0')}`;
      db.run(
        'INSERT OR REPLACE INTO ciselna_rada (rok, posledni_cislo) VALUES (?, ?)',
        [rok, dalsi],
        (err2) => err2 ? reject(err2) : resolve(cislo)
      );
    });
  });
}

// ── Faktury ───────────────────────────────────────────────
app.get('/api/faktury', (req, res) => {
  const { zakazka_id, stav, typ } = req.query;
  let query = 'SELECT * FROM faktury WHERE 1=1';
  const params = [];
  if (zakazka_id) { query += ' AND zakazka_id = ?'; params.push(zakazka_id); }
  if (stav) { query += ' AND stav = ?'; params.push(stav); }
  if (typ) { query += ' AND typ = ?'; params.push(typ); }
  query += ' ORDER BY COALESCE(datum_aktualizace, datum_vytvoreni) DESC';
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({
      ...r,
      dodavatel: JSON.parse(r.dodavatel || '{}'),
      odberatel: JSON.parse(r.odberatel || '{}'),
      polozky: JSON.parse(r.polozky || '[]'),
    })));
  });
});

app.get('/api/faktury/:id', (req, res) => {
  db.get('SELECT * FROM faktury WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Faktura nenalezena' });
    res.json({
      ...row,
      dodavatel: JSON.parse(row.dodavatel || '{}'),
      odberatel: JSON.parse(row.odberatel || '{}'),
      polozky: JSON.parse(row.polozky || '[]'),
    });
  });
});

app.post('/api/faktury', (req, res) => {
  const { zakazka_id, typ, stav, datum_vystaveni, datum_splatnosti,
    datum_zaplaceni, variabilni_symbol, castka_celkem, poznamka,
    dodavatel, odberatel, polozky, cislo: vlastniCislo } = req.body;

  if (!zakazka_id) return res.status(400).json({ error: 'Chybí zakazka_id' });
  if (!datum_splatnosti) return res.status(400).json({ error: 'Chybí datum_splatnosti' });

  // Pokud uživatel zadal vlastní číslo, zkontroluj duplicitu
  if (vlastniCislo) {
    db.get('SELECT id FROM faktury WHERE cislo = ?', [vlastniCislo], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) return res.status(409).json({ error: `Faktura s číslem ${vlastniCislo} již existuje` });
      vlozFakturu(vlastniCislo);
    });
  } else {
    dalsiCisloFaktury().then(cislo => vlozFakturu(cislo)).catch(err => res.status(500).json({ error: err.message }));
  }

  function vlozFakturu(cislo) {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO faktury (id, cislo, zakazka_id, typ, stav, datum_vystaveni, datum_splatnosti,
        datum_zaplaceni, variabilni_symbol, castka_celkem, poznamka,
        dodavatel, odberatel, polozky, datum_vytvoreni, datum_aktualizace)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, cislo, zakazka_id, typ || 'konecna', stav || 'vystavena',
       datum_vystaveni || now.slice(0, 10), datum_splatnosti,
       datum_zaplaceni || null, variabilni_symbol || cislo,
       castka_celkem || 0, poznamka || '',
       JSON.stringify(dodavatel || {}), JSON.stringify(odberatel || {}),
       JSON.stringify(polozky || []), now, now],
      (err) => {
        if (err) {
          // UNIQUE constraint — duplicitní číslo (race condition)
          if (err.message?.includes('UNIQUE')) {
            return res.status(409).json({ error: `Faktura s číslem ${cislo} již existuje` });
          }
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id, cislo });
      }
    );
  }
});

app.patch('/api/faktury/:id', (req, res) => {
  const allowed = ['stav', 'datum_splatnosti', 'datum_zaplaceni', 'variabilni_symbol',
    'castka_celkem', 'poznamka', 'odberatel', 'polozky'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      sets.push(`${key} = ?`);
      vals.push(typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : req.body[key]);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Žádná platná pole k aktualizaci' });
  sets.push('datum_aktualizace = ?');
  vals.push(new Date().toISOString());
  vals.push(req.params.id);
  db.run(`UPDATE faktury SET ${sets.join(', ')} WHERE id = ?`, vals,
    err => err ? res.status(500).json({ error: err.message }) : res.sendStatus(200)
  );
});

// ── Faktura PDF ──────────────────────────────────────────
app.get('/api/faktury/:id/pdf', (req, res) => {
  db.get('SELECT * FROM faktury WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Faktura nenalezena' });

    const faktura = {
      ...row,
      dodavatel: JSON.parse(row.dodavatel || '{}'),
      odberatel: JSON.parse(row.odberatel || '{}'),
      polozky: JSON.parse(row.polozky || '[]'),
    };

    try {
      const pdfDoc = generateFakturaPdf(faktura);
      const chunks = [];
      pdfDoc.on('data', chunk => chunks.push(chunk));
      pdfDoc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="faktura-${faktura.cislo}.pdf"`);
        res.send(pdfBuffer);
      });
      pdfDoc.end();
    } catch (e) {
      console.error('PDF generování selhalo:', e);
      res.status(500).json({ error: 'Chyba při generování PDF' });
    }
  });
});

app.delete('/api/faktury/:id', (req, res) => {
  db.run('DELETE FROM faktury WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.sendStatus(200);
  });
});

// ── Číselná řada – správa ─────────────────────────────────
app.get('/api/ciselna-rada', (_req, res) => {
  db.all('SELECT * FROM ciselna_rada ORDER BY rok DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/api/ciselna-rada/:rok', (req, res) => {
  const rok = parseInt(req.params.rok);
  const { posledni_cislo } = req.body;
  if (isNaN(rok) || isNaN(posledni_cislo)) return res.status(400).json({ error: 'Neplatné parametry' });
  db.run(
    'INSERT OR REPLACE INTO ciselna_rada (rok, posledni_cislo) VALUES (?, ?)',
    [rok, posledni_cislo],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ rok, posledni_cislo });
    }
  );
});

app.delete('/api/ciselna-rada/:rok', (req, res) => {
  const rok = parseInt(req.params.rok);
  db.run('DELETE FROM ciselna_rada WHERE rok = ?', [rok], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.sendStatus(200);
  });
});

// ── Google Drive API ──────────────────────────────────────
app.get('/api/drive/test', async (_req, res) => {
  try {
    // Lazy import, aby se nezalamoval server, pokud googleapis ještě není nainstalováno
    console.log('Testing Google Drive API...');
    const { testConnection } = await import('./services/googleDrive.js');
    const result = await testConnection();
    res.json(result);
  } catch (error) {
    console.error('Google Drive test error:', error);
    res.status(500).json({ ready: false, error: error.message });
  }
});

app.get('/api/drive/list', async (req, res) => {
  try {
    const { listFolder } = await import('./services/googleDrive.js');
    const folderId = req.query.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
    const query = req.query.q || '';
    const files = await listFolder(folderId, query);
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/drive/find-folder', async (req, res) => {
  try {
    const { findFolderByName } = await import('./services/googleDrive.js');
    const name = req.query.name;
    const parentId = req.query.parentId || 'root';
    if (!name) {
      return res.status(400).json({ error: 'Chybí parametr name' });
    }
    const folderId = await findFolderByName(name, parentId);
    res.json({ folderId, found: !!folderId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint pro ověření, že API je dostupné
app.get('/api/debug', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Testovací Drive endpoint bez importu
app.get('/api/drive/simple-test', (_req, res) => {
  res.json({ working: true, path: '/api/drive/simple-test' });
});

// ── SPA + statický obsah ──────────────────────────────────
const clientDistPath = join(__dirname, 'dist');
if (existsSync(join(clientDistPath, 'index.html'))) {
  app.use(express.static(clientDistPath));
  app.use('/assets', express.static(join(__dirname, 'assets')));
  app.get('*', (_req, res) => res.sendFile(join(clientDistPath, 'index.html')));
  console.log('Frontend build servírován z ./dist');
} else {
  console.log('⚠️  Frontend build nenalezen (dist/index.html) – běžím v API-only módu');
  app.get('*', (_req, res) => res.status(404).json({ error: 'Frontend build nenalezen. Spusťte npm run build.' }));
}

// ── Start ─────────────────────────────────────────────────
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend běží na http://localhost:${port}`));