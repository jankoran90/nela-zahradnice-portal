import { useState, useEffect } from 'react';
import { Uzivatel, Zakazka } from '../../types/garden';
import { upsertUzivatel, generateId } from '../../services/database';

interface Props {
  zakaznik: Uzivatel;
  zakazky: Zakazka[];
  onZpet: () => void;
  onUlozeno: (u: Uzivatel) => void;
}

export function ZakaznikDetail({ zakaznik, zakazky, onZpet, onUlozeno }: Props) {
  const [jmeno, setJmeno] = useState(zakaznik.jmeno);
  const [email, setEmail] = useState(zakaznik.email);
  const [ulozeno, setUlozeno] = useState(false);
  const [chyba, setChyba] = useState('');

  const zakazkyZakaznika = zakazky.filter(z =>
    z.zakaznik_email?.toLowerCase() === zakaznik.email.toLowerCase()
  );
  const celkovaCena = zakazkyZakaznika.reduce(
    (sum, z) => sum + (z.polozky ?? []).reduce((s, p) => s + p.mnozstvi * p.cena_za_jednotku, 0), 0
  );

  useEffect(() => { setUlozeno(false); }, [jmeno, email]);

  async function handleUlozit() {
    if (!jmeno.trim() || !email.trim()) {
      setChyba('Jméno a e-mail jsou povinné.');
      return;
    }
    const updated: Uzivatel = { ...zakaznik, jmeno: jmeno.trim(), email: email.trim() };
    await upsertUzivatel(updated);
    setUlozeno(true);
    setChyba('');
    onUlozeno(updated);
  }

  async function handleResetToken() {
    const updated: Uzivatel = {
      ...zakaznik,
      token: generateId(),
      token_pouzit: false,
      heslo_hash: '',
    };
    await upsertUzivatel(updated);
    setUlozeno(true);
    onUlozeno(updated);
  }

  const zmeneno = jmeno !== zakaznik.jmeno || email !== zakaznik.email;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <button onClick={onZpet} className="text-sm text-gray-500 hover:text-green-600 mb-4 transition-colors">
        ← Zpět na zákazníky
      </button>

      {/* Hlavička */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-green-800">{zakaznik.jmeno}</h2>
            <p className="text-sm text-gray-500 mt-0.5">✉️ {zakaznik.email}</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
            zakaznik.token_pouzit
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {zakaznik.token_pouzit ? 'Aktivní' : 'Čeká na aktivaci'}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
          <span>📋 {zakazkyZakaznika.length} zakázek</span>
          <span>💰 {celkovaCena.toLocaleString('cs-CZ')} Kč celkem</span>
          <span>Od {new Date(zakaznik.datum_vytvoreni).toLocaleDateString('cs-CZ')}</span>
        </div>
      </div>

      {/* Editace */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Upravit údaje</h3>

        {chyba && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-3">{chyba}</div>
        )}
        {ulozeno && (
          <div className="bg-green-50 text-green-600 text-sm rounded-lg px-3 py-2 mb-3">✓ Uloženo</div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Jméno</label>
            <input
              type="text"
              value={jmeno}
              onChange={e => setJmeno(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleUlozit}
              disabled={!zmeneno}
              className={`font-semibold px-4 py-2 rounded-xl text-sm transition-colors ${
                zmeneno
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Uložit změny
            </button>
            {zmeneno && (
              <button
                onClick={() => { setJmeno(zakaznik.jmeno); setEmail(zakaznik.email); }}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Zrušit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reset tokenu */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Přístupový token</h3>
        <p className="text-xs text-gray-400 mb-3">
          Resetováním tokenu vygenerujete nový pozvánkový odkaz. Zákazník si bude muset nastavit nové heslo.
        </p>
        {zakaznik.token && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 mb-3 break-all">
            {window.location.origin}/?token={zakaznik.token}
          </div>
        )}
        <button
          onClick={() => { if (confirm('Resetovat token? Zákazník si bude muset nastavit nové heslo.')) handleResetToken(); }}
          className="text-sm text-orange-600 hover:text-orange-800 font-medium transition-colors"
        >
          🔄 Resetovat token
        </button>
      </div>

      {/* Zakázky zákazníka */}
      {zakazkyZakaznika.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Zakázky</h3>
          <div className="space-y-2">
            {zakazkyZakaznika.map(z => (
              <div key={z.id} className="flex items-center justify-between text-sm py-1.5">
                <div className="min-w-0">
                  <span className="text-xs font-mono text-gray-400 mr-1">#{z.cislo}</span>
                  <span className="text-gray-700">{z.nazev}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                  z.stav === 'dokonceno' ? 'bg-gray-100 text-gray-600' :
                  z.stav === 'stornovano' ? 'bg-red-100 text-red-700' :
                  'bg-green-100 text-green-800'
                }`}>
                  {z.stav}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
