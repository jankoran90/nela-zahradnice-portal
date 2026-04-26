import { Faktura, TypFaktury, StavFaktury, STAVY_FAKTURY, TYPY_FAKTURY, Uzivatel, Zakazka, DEFAULT_DODAVATEL } from '../../types/garden';
import { fakturaPdfUrl, patchFaktura } from '../../services/database';

interface Props {
  faktura: Faktura;
  uzivatel: Uzivatel;
  zakazky: Zakazka[];
  onZpet: () => void;
  onAktualizovano: (f: Faktura) => void;
}

const STAV_LABEL: Record<StavFaktury, string> = {
  vystavena:  'Vystavena',
  odeslana:   'Odeslána',
  zaplacena:  'Zaplacena',
  stornovana: 'Stornována',
};

const TYP_LABEL: Record<TypFaktury, string> = {
  zalohova: 'Zálohová',
  konecna:  'Konečná',
  dobropis: 'Dobropis',
};

export function FakturaDetail({ faktura, uzivatel, zakazky, onZpet, onAktualizovano }: Props) {
  const zakazka = zakazky.find(z => z.id === faktura.zakazka_id);

  async function zmenStav(novyStav: StavFaktury) {
    const update: Record<string, unknown> = { stav: novyStav };
    if (novyStav === 'zaplacena') update.datum_zaplaceni = new Date().toISOString().slice(0, 10);
    await patchFaktura(faktura.id, update);
    onAktualizovano({ ...faktura, stav: novyStav });
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Záhlaví */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onZpet} className="text-sm text-gray-500 hover:text-green-700 transition-colors">← Zpět</button>
        <span className="text-gray-300">|</span>
        <h2 className="text-xl font-bold text-green-800">Faktura {faktura.cislo}</h2>
      </div>

      {/* Stav + akce */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{TYP_LABEL[faktura.typ]}</span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              faktura.stav === 'vystavena' ? 'bg-yellow-100 text-yellow-800' :
              faktura.stav === 'odeslana' ? 'bg-blue-100 text-blue-800' :
              faktura.stav === 'zaplacena' ? 'bg-green-100 text-green-800' :
              'bg-red-100 text-red-700'
            }`}>{STAV_LABEL[faktura.stav]}</span>
          </div>
          {uzivatel.role === 'majitel' && (
            <div className="flex gap-2">
              {faktura.stav === 'vystavena' && (
                <button onClick={() => zmenStav('odeslana')} className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                  📤 Označit odeslanou
                </button>
              )}
              {faktura.stav === 'odeslana' && (
                <button onClick={() => zmenStav('zaplacena')} className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                  ✅ Označit zaplacenou
                </button>
              )}
              <a
                href={fakturaPdfUrl(faktura.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
              >
                📥 Stáhnout PDF
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Info bloky */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Dodavatel</h3>
          <p className="font-semibold text-gray-800">{faktura.dodavatel?.jmeno || DEFAULT_DODAVATEL.jmeno}</p>
          <p className="text-sm text-gray-600">{faktura.dodavatel?.adresa || DEFAULT_DODAVATEL.adresa}</p>
          {faktura.dodavatel?.ico && <p className="text-sm text-gray-500">IČO: {faktura.dodavatel.ico}</p>}
          {faktura.dodavatel?.dic && <p className="text-sm text-gray-500">DIČ: {faktura.dodavatel.dic}</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Odběratel</h3>
          <p className="font-semibold text-gray-800">{faktura.odberatel?.jmeno || '—'}</p>
          <p className="text-sm text-gray-600">{faktura.odberatel?.adresa || ''}</p>
          {faktura.odberatel?.ico && <p className="text-sm text-gray-500">IČO: {faktura.odberatel.ico}</p>}
        </div>
      </div>

      {/* Datumy + platební údaje */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400">Vystavena</p>
            <p className="font-medium">{new Date(faktura.datum_vystaveni).toLocaleDateString('cs-CZ')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Splatnost</p>
            <p className="font-medium">{new Date(faktura.datum_splatnosti).toLocaleDateString('cs-CZ')}</p>
          </div>
          {faktura.datum_zaplaceni && (
            <div>
              <p className="text-xs text-gray-400">Zaplaceno</p>
              <p className="font-medium text-green-700">{new Date(faktura.datum_zaplaceni).toLocaleDateString('cs-CZ')}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400">VS</p>
            <p className="font-medium font-mono">{faktura.variabilni_symbol}</p>
          </div>
        </div>
        {(faktura.dodavatel?.iban || faktura.dodavatel?.ucet) && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
            <span className="text-xs text-gray-400">Účet: </span>
            <span className="font-medium font-mono">{faktura.dodavatel.iban || faktura.dodavatel.ucet}</span>
          </div>
        )}
      </div>

      {/* Položky */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Položky</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b">
              <th className="text-left py-2">Název</th>
              <th className="text-right py-2">Množství</th>
              <th className="text-right py-2">Cena/j.</th>
              <th className="text-right py-2">Celkem</th>
            </tr>
          </thead>
          <tbody>
            {faktura.polozky.map(p => (
              <tr key={p.id} className="border-b border-gray-50">
                <td className="py-2">{p.nazev}</td>
                <td className="py-2 text-right text-gray-600">{p.mnozstvi} {p.jednotka}</td>
                <td className="py-2 text-right text-gray-600">{p.cena_za_jednotku.toLocaleString('cs-CZ')} Kč</td>
                <td className="py-2 text-right font-medium">{p.celkova_cena.toLocaleString('cs-CZ')} Kč</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
          <span className="font-bold text-green-800 text-lg">Celkem</span>
          <span className="font-bold text-green-800 text-lg">{faktura.castka_celkem.toLocaleString('cs-CZ')} Kč</span>
        </div>
      </div>

      {/* Poznámka */}
      {faktura.poznamka && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Poznámka</h3>
          <p className="text-sm text-gray-700 whitespace-pre-line">{faktura.poznamka}</p>
        </div>
      )}

      {/* Zákazka odkaz */}
      {zakazka && (
        <div className="text-sm text-gray-500 mt-4">
          Zakázka: <span className="font-medium text-gray-700">#{zakazka.cislo} {zakazka.nazev}</span>
        </div>
      )}
    </div>
  );
}
