import { useState } from 'react';
import { Uzivatel, Zakazka } from '../../types/garden';

interface Props {
  uzivatele: Uzivatel[];
  zakazky: Zakazka[];
  onVybrat: (u: Uzivatel) => void;
  onNovyZakaznik: (email: string, jmeno: string) => Promise<void>;
}

export function ZakazniciList({ uzivatele, zakazky, onVybrat, onNovyZakaznik }: Props) {
  const [zobrazitFormular, setZobrazitFormular] = useState(false);
  const [novyEmail, setNovyEmail] = useState('');
  const [noveJmeno, setNoveJmeno] = useState('');
  const [chyba, setChyba] = useState('');

  const zakaznici = uzivatele.filter(u => u.role === 'zakaznik');
  const serazeni = [...zakaznici].sort((a, b) => {
    const rozdel = (j: string) => { const parts = j.trim().split(/\s+/); return { prijmeni: (parts[1] || parts[0] || '').toLowerCase(), krestni: (parts[0] || '').toLowerCase() }; };
    const ra = rozdel(a.jmeno), rb = rozdel(b.jmeno);
    return ra.prijmeni.localeCompare(rb.prijmeni) || ra.krestni.localeCompare(rb.krestni);
  });

  function pocetZakazek(zakaznikEmail: string): number {
    return zakazky.filter(z =>
      z.zakaznik_email?.toLowerCase() === zakaznikEmail.toLowerCase()
    ).length;
  }

  function celkovaCena(zakaznikEmail: string): number {
    return zakazky
      .filter(z => z.zakaznik_email?.toLowerCase() === zakaznikEmail.toLowerCase())
      .reduce((sum, z) => sum + (z.polozky ?? []).reduce((s, p) => s + p.mnozstvi * p.cena_za_jednotku, 0), 0);
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-green-800">👥 Zákazníci</h2>
          <p className="text-sm text-gray-500">{zakaznici.length} zákazníků celkem</p>
        </div>
        {!zobrazitFormular ? (
          <button
            onClick={() => setZobrazitFormular(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            + Nový zákazník
          </button>
        ) : (
          <button
            onClick={() => { setZobrazitFormular(false); setChyba(''); }}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Zrušit
          </button>
        )}
      </div>

      {zobrazitFormular && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Nový zákazník</h3>
          {chyba && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-3">{chyba}</div>}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Jméno"
              value={noveJmeno}
              onChange={e => setNoveJmeno(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-all"
            />
            <input
              type="email"
              placeholder="E-mail"
              value={novyEmail}
              onChange={e => setNovyEmail(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none transition-all"
            />
            <button
              onClick={async () => {
                if (!noveJmeno.trim() || !novyEmail.trim()) { setChyba('Jméno a e-mail jsou povinné.'); return; }
                await onNovyZakaznik(novyEmail.trim(), noveJmeno.trim());
                setNovyEmail(''); setNoveJmeno(''); setChyba(''); setZobrazitFormular(false);
              }}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors shrink-0"
            >
              Vytvořit
            </button>
          </div>
        </div>
      )}

      {serazeni.length === 0 && !zobrazitFormular && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">👤</div>
          <p className="font-medium">Zatím žádní zákazníci</p>
          <p className="text-sm mt-1">Přidejte prvního kliknutím na „+ Nový zákazník".</p>
        </div>
      )}

      <div className="space-y-3">
        {serazeni.map(u => {
          const nz = pocetZakazek(u.email);
          const cc = celkovaCena(u.email);
          return (
            <div
              key={u.id}
              onClick={() => onVybrat(u)}
              className="bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer hover:border-green-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">{u.jmeno}</h3>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">✉️ {u.email}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                  u.token_pouzit
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {u.token_pouzit ? 'Aktivní' : 'Čeká na aktivaci'}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                <span>📋 {nz} zakázek · 💰 {cc.toLocaleString('cs-CZ')} Kč</span>
                <span>Od {new Date(u.datum_vytvoreni).toLocaleDateString('cs-CZ')}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
