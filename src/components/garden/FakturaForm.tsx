import React, { useState, useEffect } from 'react';
import { Zakazka, Uzivatel, TypFaktury, TYPY_FAKTURY, DEFAULT_DODAVATEL, FakturaOsoba, FakturaPolozka, Faktura } from '../../types/garden';
import { vytvorFakturu, getFaktury } from '../../services/database';

interface Props {
  uzivatel: Uzivatel;
  zakazky: Zakazka[];
  predvolenaZakazka?: Zakazka;
  onHotovo: () => void;
  onZrusit: () => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function splatnostDatum(dny: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dny);
  return d.toISOString().slice(0, 10);
}

export function FakturaForm({ uzivatel, zakazky, predvolenaZakazka, onHotovo, onZrusit }: Props) {
  const [zakazkaId, setZakazkaId] = useState(predvolenaZakazka?.id || '');
  const [typ, setTyp] = useState<TypFaktury>('konecna');
  const [datumVystaveni, setDatumVystaveni] = useState(todayStr());
  const [datumSplatnosti, setDatumSplatnosti] = useState(splatnostDatum(14));
  const [vlastniCislo, setVlastniCislo] = useState('');
  const [poznamka, setPoznamka] = useState('');
  const [loading, setLoading] = useState(false);
  const [chyba, setChyba] = useState('');
  const [existujiciCisla, setExistujiciCisla] = useState<Set<string>>(new Set());

  // Načti existující čísla faktur pro kontrolu duplicity
  useEffect(() => {
    getFaktury().then((vse: Faktura[]) => {
      setExistujiciCisla(new Set(vse.map(f => f.cislo)));
    });
  }, []);

  const vybranaZakazka = zakazky.find(z => z.id === zakazkaId);

  // Položky ze zakázky
  const polozky: FakturaPolozka[] = (vybranaZakazka?.polozky ?? []).map(p => ({
    id: p.id,
    nazev: p.nazev,
    kategorie: p.kategorie,
    mnozstvi: p.mnozstvi,
    jednotka: p.jednotka,
    cena_za_jednotku: p.cena_za_jednotku,
    celkova_cena: p.mnozstvi * p.cena_za_jednotku,
  }));

  const castkaCelkem = polozky.reduce((s, p) => s + p.celkova_cena, 0);

  // Odběratel ze zakázky
  const odberatel: FakturaOsoba = vybranaZakazka ? {
    jmeno: vybranaZakazka.zakaznik_jmeno,
    adresa: vybranaZakazka.adresa,
    email: vybranaZakazka.zakaznik_email,
  } : { jmeno: '', adresa: '' };

  // Kontrola duplicity čísla
  const cisloDuplicita = !!vlastniCislo && existujiciCisla.has(vlastniCislo);

  async function odeslat() {
    if (!zakazkaId) { setChyba('Vyberte zakázku'); return; }
    if (!datumSplatnosti) { setChyba('Zadejte datum splatnosti'); return; }
    if (cisloDuplicita) { setChyba(`Číslo faktury ${vlastniCislo} již existuje`); return; }
    setLoading(true);
    setChyba('');
    try {
      await vytvorFakturu({
        zakazka_id: zakazkaId,
        typ,
        datum_vystaveni: datumVystaveni,
        datum_splatnosti: datumSplatnosti,
        poznamka,
        castka_celkem: castkaCelkem,
        dodavatel: DEFAULT_DODAVATEL,
        odberatel,
        polozky,
        ...(vlastniCislo ? { cislo: vlastniCislo } : {}),
      });
      onHotovo();
    } catch (e: any) {
      setChyba(e.message || 'Chyba při vytváření faktury');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onZrusit} className="text-sm text-gray-500 hover:text-green-700 transition-colors">← Zpět</button>
        <span className="text-gray-300">|</span>
        <h2 className="text-xl font-bold text-green-800">Nová faktura</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        {/* Výběr zakázky */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Zakázka</label>
          {predvolenaZakazka ? (
            <div className="bg-green-50 rounded-lg p-3 text-sm">
              <span className="font-mono text-gray-400">#{predvolenaZakazka.cislo}</span>
              <span className="ml-2 font-medium">{predvolenaZakazka.nazev}</span>
              <span className="ml-2 text-gray-500">— {predvolenaZakazka.zakaznik_jmeno}</span>
            </div>
          ) : (
            <select
              value={zakazkaId}
              onChange={e => setZakazkaId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">— Vyberte zakázku —</option>
              {zakazky.map(z => (
                <option key={z.id} value={z.id}>#{z.cislo} {z.nazev} — {z.zakaznik_jmeno}</option>
              ))}
            </select>
          )}
        </div>

        {/* Typ faktury */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Typ faktury</label>
          <div className="flex gap-2">
            {TYPY_FAKTURY.map(t => (
              <button
                key={t.value}
                onClick={() => setTyp(t.value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  typ === t.value ? 'bg-green-100 text-green-800 ring-1 ring-green-400' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >{t.label}</button>
            ))}
          </div>
        </div>

        {/* Číslo faktury */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Číslo faktury</label>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={vlastniCislo}
              onChange={e => setVlastniCislo(e.target.value)}
              placeholder="Automaticky (např. 20260001)"
              className={`flex-1 border rounded-lg px-3 py-2 text-sm font-mono ${
                cisloDuplicita ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
            />
            {vlastniCislo && cisloDuplicita && (
              <span className="text-xs text-red-600 font-medium">⚠️ Duplicita</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">Ponechte prázdné pro automatické číslo.</p>
        </div>

        {/* Datum vystavení */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Datum vystavení</label>
          <input
            type="date"
            value={datumVystaveni}
            onChange={e => setDatumVystaveni(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Datum splatnosti */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Datum splatnosti</label>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={datumSplatnosti}
              onChange={e => setDatumSplatnosti(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-1">
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setDatumSplatnosti(splatnostDatum(d))}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    datumSplatnosti === splatnostDatum(d) ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >{d} dní</button>
              ))}
            </div>
          </div>
        </div>

        {/* Poznámka */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Poznámka</label>
          <textarea
            value={poznamka}
            onChange={e => setPoznamka(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Volitelná poznámka na fakturu..."
          />
        </div>
      </div>

      {/* Náhled položek a odběratele */}
      {vybranaZakazka && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Odběratel</h3>
            <p className="font-semibold text-gray-800">{odberatel.jmeno}</p>
            <p className="text-sm text-gray-600">{odberatel.adresa}</p>
            {odberatel.email && <p className="text-sm text-gray-500">{odberatel.email}</p>}
          </div>

          {polozky.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Položky ze zakázky</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b">
                    <th className="text-left py-1">Kategorie</th>
                    <th className="text-left py-1">Položka</th>
                    <th className="text-right py-1">Množství</th>
                    <th className="text-right py-1">Celkem</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const katOrder: string[] = [];
                    const katMap: Record<string, FakturaPolozka[]> = {};
                    for (const p of polozky) {
                      const k = p.kategorie || 'Bez kategorie';
                      if (!katMap[k]) { katOrder.push(k); katMap[k] = []; }
                      katMap[k].push(p);
                    }
                    const rows: React.ReactNode[] = [];
                    for (const kat of katOrder) {
                      rows.push(
                        <tr key={`kat-${kat}`} className="bg-green-50">
                          <td colSpan={4} className="py-1 px-2 font-semibold text-green-800 text-xs uppercase">{kat}</td>
                        </tr>
                      );
                      for (const p of katMap[kat]) {
                        rows.push(
                          <tr key={p.id} className="border-b border-gray-50">
                            <td className="py-1"></td>
                            <td className="py-1">{p.nazev}</td>
                            <td className="py-1 text-right text-gray-600">{p.mnozstvi} {p.jednotka}</td>
                            <td className="py-1 text-right font-medium">{p.celkova_cena.toLocaleString('cs-CZ')} Kč</td>
                          </tr>
                        );
                      }
                    }
                    return rows;
                  })()}
                </tbody>
              </table>
              <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                <span className="font-bold text-green-800">Celkem</span>
                <span className="font-bold text-green-800 text-lg">{castkaCelkem.toLocaleString('cs-CZ')} Kč</span>
              </div>
            </div>
          )}

          {polozky.length === 0 && (
            <div className="bg-yellow-50 rounded-2xl border border-yellow-200 p-4 mb-4 text-sm text-yellow-800">
              ⚠️ Zakázka nemá žádné položky. Faktura bude vytvořena s nulovou částkou.
            </div>
          )}
        </>
      )}

      {chyba && (
        <div className="bg-red-50 rounded-xl p-3 mb-4 text-sm text-red-700">{chyba}</div>
      )}

      {/* Tlačítka */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onZrusit}
          className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >Zrušit</button>
        <button
          onClick={odeslat}
          disabled={loading || !zakazkaId || cisloDuplicita}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded-xl text-sm transition-colors"
        >
          {loading ? 'Vytvářím...' : 'Vytvořit fakturu'}
        </button>
      </div>
    </div>
  );
}
