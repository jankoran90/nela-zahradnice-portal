import { useState, useEffect } from 'react';
import { Faktura, StavFaktury, TypFaktury, TYPY_FAKTURY, STAVY_FAKTURY, Uzivatel, Zakazka } from '../../types/garden';
import { getFaktury, fakturaPdfUrl, patchFaktura, deleteFaktura } from '../../services/database';

interface Props {
  uzivatel: Uzivatel;
  zakazky: Zakazka[];
  onDetail: (f: Faktura) => void;
  onNova?: () => void;
}

const STAV_LABEL: Record<StavFaktury, string> = {
  vystavena:  'Vystavena',
  odeslana:   'Odeslána',
  zaplacena:  'Zaplacena',
  stornovana: 'Stornována',
};

const STAV_COLOR: Record<StavFaktury, string> = {
  vystavena:  'bg-yellow-100 text-yellow-800',
  odeslana:   'bg-blue-100 text-blue-800',
  zaplacena:  'bg-green-100 text-green-800',
  stornovana: 'bg-red-100 text-red-700',
};

const TYP_LABEL: Record<TypFaktury, string> = {
  zalohova: 'Zálohová',
  konecna:  'Konečná',
  dobropis: 'Dobropis',
};

export function FakturyList({ uzivatel, zakazky, onDetail, onNova }: Props) {
  const [faktury, setFaktury] = useState<Faktura[]>([]);
  const [filtrStav, setFiltrStav] = useState<string>('');
  const [filtrTyp, setFiltrTyp] = useState<string>('');

  async function reload() {
    const params: Record<string, string> = {};
    if (filtrStav) params.stav = filtrStav;
    if (filtrTyp) params.typ = filtrTyp;
    const data = await getFaktury(params);
    setFaktury(data);
  }

  useEffect(() => { reload(); }, [filtrStav, filtrTyp]);

  function zakazkaNazov(zakazka_id: string): string {
    const z = zakazky.find(x => x.id === zakazka_id);
    return z ? `#${z.cislo} ${z.nazev}` : zakazka_id.slice(0, 8);
  }

  async function zmenStav(f: Faktura, novyStav: StavFaktury) {
    await patchFaktura(f.id, { stav: novyStav });
    reload();
  }

  async function smaz(f: Faktura) {
    if (!confirm(`Smazat fakturu ${f.cislo}?`)) return;
    await deleteFaktura(f.id);
    reload();
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-green-800">📄 Faktury</h2>
          <p className="text-sm text-gray-500">{faktury.length} faktur celkem</p>
        </div>
        {uzivatel.role === 'majitel' && (
          <button
            onClick={onNova}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            + Nová faktura
          </button>
        )}
      </div>

      {/* Filtry */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={filtrStav}
          onChange={e => setFiltrStav(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="">Všechny stavy</option>
          {STAVY_FAKTURY.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filtrTyp}
          onChange={e => setFiltrTyp(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="">Všechny typy</option>
          {TYPY_FAKTURY.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {faktury.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">📄</div>
          <p className="font-medium">Zatím žádné faktury</p>
        </div>
      )}

      <div className="space-y-3">
        {faktury.map(f => (
          <div
            key={f.id}
            onClick={() => onDetail(f)}
            className="bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer hover:border-green-400 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-gray-400">{f.cislo}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{TYP_LABEL[f.typ]}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1 truncate">
                  📋 {zakazkaNazov(f.zakazka_id)}
                </p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STAV_COLOR[f.stav]}`}>
                {STAV_LABEL[f.stav]}
              </span>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
              <span className="font-semibold text-gray-700 text-sm">
                💰 {f.castka_celkem.toLocaleString('cs-CZ')} Kč
              </span>
              <div className="flex items-center gap-2">
                {uzivatel.role === 'majitel' && (
                  <>
                    <a
                      href={fakturaPdfUrl(f.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-green-600 hover:text-green-800 font-medium transition-colors"
                      title="Stáhnout PDF"
                    >📥 PDF</a>
                    {f.stav === 'vystavena' && (
                      <button
                        onClick={e => { e.stopPropagation(); zmenStav(f, 'odeslana'); }}
                        className="text-blue-500 hover:text-blue-700 font-medium transition-colors"
                        title="Označit jako odeslanou"
                      >📤</button>
                    )}
                    {f.stav === 'odeslana' && (
                      <button
                        onClick={e => { e.stopPropagation(); zmenStav(f, 'zaplacena'); }}
                        className="text-green-500 hover:text-green-700 font-medium transition-colors"
                        title="Označit jako zaplacenou"
                      >✅</button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); smaz(f); }}
                      className="text-red-400 hover:text-red-600 font-medium transition-colors"
                      title="Smazat"
                    >🗑️</button>
                  </>
                )}
                <span>Splatnost {new Date(f.datum_splatnosti).toLocaleDateString('cs-CZ')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
