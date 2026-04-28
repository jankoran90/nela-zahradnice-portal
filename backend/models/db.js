import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'nela.db');
const dataDir = join(__dirname, '..', 'data');

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(dbPath);

// ── Promise wrappery ──────────────────────────────────────
export function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

export function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// ── Inicializace tabulek a seed ──────────────────────────
export async function initDb() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS uzivatele (
      id TEXT PRIMARY KEY, email TEXT, jmeno TEXT, role TEXT,
      heslo_hash TEXT, token TEXT, token_pouzit INTEGER, datum_vytvoreni TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS polozka_historie (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      typ TEXT CHECK(typ IN ('kategorie', 'nazev')),
      hodnota TEXT NOT NULL,
      datum TEXT NOT NULL,
      puvod TEXT CHECK(puvod IN ('system', 'uzivatel')),
      UNIQUE(typ, hodnota)
    )`);
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

    db.run(`CREATE TABLE IF NOT EXISTS parametry (
      id TEXT PRIMARY KEY, typ TEXT, data TEXT
    )`);
  });

  // Seed: výchozí admin (použijeme async/await po serialize)
  try {
    const row = await getAsync('SELECT COUNT(*) as cnt FROM uzivatele');
    if (row.cnt === 0) {
      const hesloHash = await bcrypt.hash('nela2024', 10);
      await runAsync(
        'INSERT INTO uzivatele (id, email, jmeno, role, heslo_hash, token_pouzit, datum_vytvoreni) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['nela1', 'nela@zahradnice.cz', 'Nela', 'majitel', hesloHash, 1, new Date().toISOString()]
      );
      console.log('✅ Seed: vytvořen výchozí uživatel nela@zahradnice.cz (heslo hashováno)');
    }
  } catch (err) {
    console.error('Seed error:', err);
  }
}

export default db;