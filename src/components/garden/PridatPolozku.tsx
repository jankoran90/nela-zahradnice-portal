import { useState } from 'react';
import { PolozkaCeny } from '../../types/garden';
import { generateId } from '../../services/database';
import { AutosuggestInput } from './AutosuggestInput';

const API_URL = import.meta.env.VITE_API_URL || '';

const CELOCISELNE_JEDNOTKY = new Set(['ks', 'den', 'hod', 'paušál', 'bal', 'vůz']);

interface Props {
  onPridat: (polozka: PolozkaCeny) => void;
  onZavrit: () => void;
}

export function PridatPolozku({ onPridat, onZavrit }: Props) {
  const [kategorie, setKategorie] = useState('');
  const [nazev, setNazev] = useState('');
  const [mnozstvi, setMnozstvi] = useState('1');
  const [jednotka, setJednotka] = useState('ks');
  const [cena, setCena] = useState('0');
  const [nakupniCena, setNakupniCena] = useState('0');
  const [poznamka, setPoznamka] = useState('');
  
  const jeCelociselna = CELOCISELNE_JEDNOTKY.has(jednotka);

  // Obecný handler, který povolí v inputu pouze čísla (včetně desetinných)
  const handleNumericChange = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^[0-9]\d*(\.\d*)?$/.test(value)) {
      setter(value);
    }
  };

  function handleZmenaJednotky(j: string) {
    setJednotka(j);
    if (CELOCISELNE_JEDNOTKY.has(j)) {
      setMnozstvi(m => String(Math.max(1, Math.round(parseFloat(m) || 0))));
    }
  }

  async function handlePridat() {
    const finalMnozstvi = parseFloat(mnozstvi) || 1;
    const finalCena = parseFloat(cena) || 0;
    const finalNakupniCena = parseFloat(nakupniCena) || 0;

    if (!kategorie.trim() || !nazev.trim() || finalMnozstvi <= 0) return;

    const polozka: PolozkaCeny = {
      id: generateId(),
      nazev: nazev.trim(),
      kategorie: kategorie.trim(),
      mnozstvi: finalMnozstvi,
      jednotka,
      cena_za_jednotku: finalCena,
      nakupni_cena: finalNakupniCena > 0 ? finalNakupniCena : undefined,
      poznamka: poznamka.trim() || undefined,
    };

    onPridat(polozka);

    fetch(`${API_URL}/api/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'kategorie', value: polozka.kategorie }),
    }).catch(() => {});

    fetch(`${API_URL}/api/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'nazev', value: polozka.nazev }),
    }).catch(() => {});
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Přidat položku</h2>
          <button onClick={onZavrit} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie <span className="text-red-500">*</span></label>
            <AutosuggestInput type="kategorie" value={kategorie} onChange={setKategorie} placeholder="např. Výsadba, Zemina..." className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Název položky <span className="text-red-500">*</span></label>
            <AutosuggestInput type="nazev" value={nazev} onChange={setNazev} placeholder="např. Borovice lesní 150cm" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Množství</label>
              <input type="text" inputMode="decimal" min={jeCelociselna ? 1 : 0} step={jeCelociselna ? 1 : 0.01} value={mnozstvi} onChange={handleNumericChange(setMnozstvi)} onFocus={e => e.target.select()} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jednotka</label>
              <input value={jednotka} onChange={e => handleZmenaJednotky(e.target.value)} placeholder="ks, m2, hod..." className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prod. cena / j. (Kč)</label>
              <input type="text" inputMode="decimal" value={cena} onChange={handleNumericChange(setCena)} onFocus={e => e.target.select()} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-amber-700 mb-1">🔒 Nák. cena / j. (Kč)</label>
              <input type="text" inputMode="decimal" value={nakupniCena} onChange={handleNumericChange(setNakupniCena)} onFocus={e => e.target.select()} className="w-full border border-amber-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interní poznámka <span className="text-xs text-gray-400">(nevidí zákazník)</span></label>
            <textarea value={poznamka} onChange={e => setPoznamka(e.target.value)} placeholder="Volitelná poznámka…" rows={3} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-green-500" />
          </div>
        </div>

        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex justify-end items-center gap-3">
          <button type="button" onClick={onZavrit} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Zrušit</button>
          <button type="button" onClick={handlePridat} disabled={!kategorie.trim() || !nazev.trim()} className="px-8 py-2 text-sm font-bold text-white bg-green-600 rounded-lg disabled:bg-gray-300 enabled:hover:bg-green-700">Přidat</button>
        </div>
      </div>
    </div>
  );
}
