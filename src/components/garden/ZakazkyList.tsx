import { Zakazka, StavZakazky, Uzivatel, Faktura } from '../../types/garden';

interface Props {
  zakazky: Zakazka[];
  uzivatel: Uzivatel;
  faktury?: Faktura[];
  onVybrat: (z: Zakazka) => void;
  onNova?: () => void;
  onUpravit?: (z: Zakazka) => void;
  onSmazat?: (id: string) => void;
}

const STAV_LABEL: Record<StavZakazky, string> = {
  poptavka:     'Nabídka',
  naceneno:     'Naceněno',
  schvaleno:    'Schváleno',
  rozpracovano: 'Rozpracováno',
  dokonceno:    'Dokončeno',
  stornovano:   'Stornováno',
};

const STAV_COLOR: Record<StavZakazky, string> = {
  poptavka:     'bg-yellow-100 text-yellow-800',
  naceneno:     'bg-blue-100 text-blue-800',
  schvaleno:    'bg-green-100 text-green-800',
  rozpracovano: 'bg-orange-100 text-orange-800',
  dokonceno:    'bg-gray-100 text-gray-700',
  stornovano:   'bg-red-100 text-red-700',
};

export function ZakazkyList({ zakazky, uzivatel, faktury, onVybrat, onNova, onUpravit, onSmazat }: Props) {
  const serazene = [...zakazky].sort(
    (a, b) => b.datum_aktualizace.localeCompare(a.datum_aktualizace)
  );

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-green-800">
            {uzivatel.role === 'majitel' ? '🌿 Všechny zakázky' : '📋 Moje zakázky'}
          </h2>
          <p className="text-sm text-gray-500">{zakazky.length} zakázek celkem</p>
        </div>
        {uzivatel.role === 'majitel' && onNova && (
          <button
            onClick={onNova}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            + Nová zakázka
          </button>
        )}
      </div>

      {serazene.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🌱</div>
          <p className="font-medium">Zatím žádné zakázky</p>
          {uzivatel.role === 'majitel' && (
            <p className="text-sm mt-1">Vytvořte první kliknutím na „+ Nová zakázka".</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {serazene.map(z => (
          <div
            key={z.id}
            onClick={() => onVybrat(z)}
            className="bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer hover:border-green-400 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-gray-400">#{z.cislo}</span>
                  <h3 className="font-semibold text-gray-800 truncate">{z.nazev}</h3>
                </div>
                <p className="text-sm text-gray-500 mt-0.5 truncate">
                  👤 {z.zakaznik_jmeno}{z.adresa && <> · 📍 {z.adresa}</>}
                </p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STAV_COLOR[z.stav]}`}>
                {STAV_LABEL[z.stav]}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
              <span>💰 {(z.polozky ?? []).reduce((s, p) => s + p.mnozstvi * p.cena_za_jednotku, 0).toLocaleString('cs-CZ')} Kč</span>
              <div className="flex items-center gap-2">
                {(() => {
                  const zf = (faktury ?? []).filter(f => f.zakazka_id === z.id);
                  if (zf.length === 0) return null;
                  return zf.map(f => (
                    <span key={f.id} className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                      {f.typ === 'zalohova' ? '📝' : f.typ === 'dobropis' ? '↩️' : '📄'} {f.typ === 'zalohova' ? 'Zálohová' : f.typ === 'dobropis' ? 'Dobropis' : 'Konečná'} {f.cislo} ({new Date(f.datum_vytvoreni).toLocaleDateString('cs-CZ')})
                    </span>
                  ));
                })()}
                {uzivatel.role === 'majitel' && (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); onUpravit?.(z); }}
                      className="text-blue-500 hover:text-blue-700 font-medium transition-colors"
                      title="Upravit"
                    >✏️</button>
                    <button
                      onClick={e => { e.stopPropagation(); if (confirm(`Smazat zakázku #${z.cislo} „${z.nazev}"?`)) onSmazat?.(z.id); }}
                      className="text-red-400 hover:text-red-600 font-medium transition-colors"
                      title="Smazat"
                    >🗑️</button>
                  </>
                )}
                <span>Aktualizováno {new Date(z.datum_aktualizace).toLocaleDateString('cs-CZ')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
