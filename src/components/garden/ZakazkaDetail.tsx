import { useState, Fragment } from 'react';
import { Zakazka, StavZakazky, Uzivatel, PolozkaCeny, Faktura } from '../../types/garden';
import { KonverzacePanel } from './KonverzacePanel';
import { ProjektySekce } from './ProjektySekce';
import { PridatPolozku } from './PridatPolozku';
import { generateId, getUzivatele, upsertUzivatel } from '../../services/database';
import { useZakazky } from '../../hooks/useZakazky';
import { useAuth } from '../../hooks/useAuth';
import { exportZakazkaPdf } from '../../utils/exportPdf';

interface Props {
  zakazka: Zakazka;
  uzivatel: Uzivatel;
  uzivatele: Uzivatel[];
  onZpet: () => void;
  onAktualizovana: (z: Zakazka) => void;
  onSmazat?: (id: string) => void;
  onFaktura?: (z: Zakazka) => void;
  faktury?: Faktura[];
}

type Tab = 'detail' | 'konverzace' | 'projekt';

const STAVY: StavZakazky[] = ['poptavka','naceneno','schvaleno','rozpracovano','dokonceno','stornovano'];
const CELOCISELNE_JEDNOTKY = new Set(['ks','den','hod','paušál','bal','vůz']);
const STAV_LABEL: Record<StavZakazky, string> = {
  poptavka:'Nabídka', naceneno:'Naceněno', schvaleno:'Schváleno',
  rozpracovano:'Rozpracováno', dokonceno:'Dokončeno', stornovano:'Stornováno',
};

export function ZakazkaDetail({ zakazka, uzivatel, uzivatele, onZpet, onAktualizovana, onSmazat, onFaktura, faktury }: Props) {
  const [tab, setTab] = useState<Tab>('detail');
  const [editMode, setEditMode] = useState(false);
  const [data, setData] = useState<Zakazka>({ ...zakazka, polozky: zakazka.polozky ?? [] });
  const [showModal, setShowModal] = useState(false);
  const [vybranyZakaznikId, setVybranyZakaznikId] = useState<string>('');
  const { aktualizujZakazku, schvalZakazku } = useZakazky();
  const { vytvorZakaznika } = useAuth();
  const jeMajitel = uzivatel.role === 'majitel';
  const celkem = (data.polozky ?? []).reduce((s, p) => s + p.mnozstvi * p.cena_za_jednotku, 0);

  // Synchronizace zákazníka do adresáře
  async function syncZakaznikDoAdresare() {
    const email = data.zakaznik_email?.trim();
    const jmeno = data.zakaznik_jmeno?.trim();
    if (!email && !jmeno) return;

    const vsichni = await getUzivatele();
    // Hledej podle emailu, pak podle jména
    let existujici = email
      ? vsichni.find(u => u.email.toLowerCase() === email.toLowerCase() && u.role === 'zakaznik')
      : vsichni.find(u => u.jmeno.toLowerCase() === jmeno!.toLowerCase() && u.role === 'zakaznik');

    if (existujici) {
      // Aktualizuj kartu — přepiš jméno/email, pokud se změnil
      const zmeny: Partial<Uzivatel> = {};
      if (email && existujici.email.toLowerCase() !== email.toLowerCase()) zmeny.email = email;
      if (jmeno && existujici.jmeno !== jmeno) zmeny.jmeno = jmeno;
      if (Object.keys(zmeny).length > 0) {
        await upsertUzivatel({ ...existujici, ...zmeny });
      }
    } else if (email) {
      // Nový zákazník — vytvoř v adresáři
      await vytvorZakaznika(email, jmeno || email);
    }
  }

  function ulozit() {
    aktualizujZakazku(data);
    onAktualizovana(data);
    syncZakaznikDoAdresare();
    setEditMode(false);
  }

  function handleSchvalit() {
    schvalZakazku(data.id, uzivatel.jmeno);
    const updated: Zakazka = {
      ...data, stav: 'schvaleno', schvaleno_zakaznikem: true,
      datum_schvaleni: new Date().toISOString(), schvalil_jmeno: uzivatel.jmeno,
    };
    setData(updated);
    onAktualizovana(updated);
  }

  function handlePridatPolozku(polozka: PolozkaCeny) {
    setData(d => ({ ...d, polozky: [...d.polozky, polozka] }));
    setShowModal(false);
  }

  function aktualizujPolozku(idx: number, field: keyof PolozkaCeny, value: string | number) {
    setData(d => { const p = [...d.polozky]; p[idx] = { ...p[idx], [field]: value }; return { ...d, polozky: p }; });
  }

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto">
      {showModal && (
        <PridatPolozku
          onPridat={handlePridatPolozku}
          onZavrit={() => setShowModal(false)}
        />
      )}

      <div className="flex items-center gap-3 p-4 border-b border-gray-200 bg-white">
        <button onClick={onZpet} className="text-gray-400 hover:text-green-600 transition-colors text-xl">←</button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-800 truncate">#{data.cislo} · {data.nazev}</h2>
          <p className="text-xs text-gray-500">{data.zakaznik_jmeno}</p>
        </div>
        {jeMajitel && (
          <div className="flex items-center gap-2">
            {editMode
              ? <button onClick={ulozit} className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg">Uložit</button>
              : <button onClick={() => {
                  // Detekuj stávajícího zákazníka pro dropdown
                  const existujici = uzivatele.find(u => u.role === 'zakaznik' && u.email.toLowerCase() === data.zakaznik_email?.toLowerCase());
                  setVybranyZakaznikId(existujici?.id ?? '');
                  setEditMode(true);
                }} className="border border-gray-300 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-50">✏️ Upravit</button>
            }
            <button
              onClick={() => { if (confirm(`Smazat zakázku #${data.cislo} „${data.nazev}"?`)) onSmazat?.(data.id); }}
              className="border border-red-300 text-red-500 text-sm px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >🗑️ Smazat</button>
            <button
              onClick={() => exportZakazkaPdf(data)}
              className="border border-green-300 text-green-700 text-sm px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
            >📄 PDF</button>
            {onFaktura && (
              <button
                onClick={() => onFaktura(data)}
                className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
              >💰 Vytvořit fakturu</button>
            )}
          </div>
        )}
      </div>

      <div className="flex border-b border-gray-200 bg-white">
        {(['detail', 'projekt', 'konverzace'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === t ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'detail' ? '📋 Detail' : t === 'projekt' ? '📎 Projekt' : '💬 Poznámky'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {tab === 'detail' ? (
          <div className="p-4 space-y-6">
            <section className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Základní informace</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Název</span>
                {editMode ? (
                  <input value={data.nazev} onChange={e => setData(d => ({ ...d, nazev: e.target.value }))}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1 w-48" />
                ) : (
                  <span className="text-sm font-medium">{data.nazev}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Stav</span>
                {jeMajitel && editMode ? (
                  <select value={data.stav} onChange={e => setData(d => ({ ...d, stav: e.target.value as StavZakazky }))}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1">
                    {STAVY.map(s => <option key={s} value={s}>{STAV_LABEL[s]}</option>)}
                  </select>
                ) : (
                  <span className="text-sm font-medium">{STAV_LABEL[data.stav]}</span>
                )}
              </div>
              {(() => {
                const zf = (faktury ?? []).filter(f => f.zakazka_id === data.id);
                if (zf.length === 0) return null;
                return (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Faktury</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {zf.map(f => (
                        <span key={f.id} className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                          {f.typ === 'zalohova' ? '📝 Zálohová' : f.typ === 'dobropis' ? '↩️ Dobropis' : '📄 Konečná'} {f.cislo} ({new Date(f.datum_vytvoreni).toLocaleDateString('cs-CZ')})
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Adresa</span>
                {editMode ? (
                  <input value={data.adresa} onChange={e => setData(d => ({ ...d, adresa: e.target.value }))}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1 w-48" />
                ) : (
                  <span className="text-sm">{data.adresa || '—'}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Zákazník</span>
                {editMode ? (
                  <select
                    value={vybranyZakaznikId}
                    onChange={e => {
                      const id = e.target.value;
                      setVybranyZakaznikId(id);
                      if (id && id !== '__novy') {
                        const z = uzivatele.find(u => u.id === id);
                        if (z) setData(d => ({ ...d, zakaznik_jmeno: z.jmeno, zakaznik_email: z.email }));
                      } else if (id === '__novy') {
                        setData(d => ({ ...d, zakaznik_jmeno: '', zakaznik_email: '' }));
                      }
                    }}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1 w-48 bg-white"
                  >
                    <option value="">— vyberte —</option>
                    {uzivatele.filter(u => u.role === 'zakaznik').map(u => (
                      <option key={u.id} value={u.id}>{u.jmeno} ({u.email})</option>
                    ))}
                    <option value="__novy">+ Nový…</option>
                  </select>
                ) : (
                  <span className="text-sm">{data.zakaznik_jmeno || '—'}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">E-mail zákazníka</span>
                {editMode ? (
                  <input type="email" value={data.zakaznik_email ?? ''} onChange={e => { setData(d => ({ ...d, zakaznik_email: e.target.value })); setVybranyZakaznikId(''); }}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1 w-48" />
                ) : (
                  <span className="text-sm">{data.zakaznik_email || '—'}</span>
                )}
              </div>
              {editMode && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Jméno zákazníka</span>
                  <input value={data.zakaznik_jmeno} onChange={e => { setData(d => ({ ...d, zakaznik_jmeno: e.target.value })); setVybranyZakaznikId(''); }}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1 w-48" />
                </div>
              )}
              {data.schvaleno_zakaznikem && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Schválil</span>
                  <span className="text-sm text-green-700 font-medium">
                    ✅ {data.schvalil_jmeno} · {new Date(data.datum_schvaleni!).toLocaleDateString('cs-CZ')}
                  </span>
                </div>
              )}
              {jeMajitel && (
                <div>
                  <span className="text-sm text-gray-600 block mb-1">Interní poznámka</span>
                  {editMode ? (
                    <textarea value={data.poznamka_interna ?? ''} onChange={e => setData(d => ({ ...d, poznamka_interna: e.target.value }))}
                      rows={2} className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1 resize-none" />
                  ) : (
                    <p className="text-sm text-gray-500 italic">{data.poznamka_interna || 'Žádná poznámka'}</p>
                  )}
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Položky rozpočtu</h3>
                {jeMajitel && editMode && (
                  <button onClick={() => setShowModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1.5 rounded-lg font-medium transition-colors">
                    + Přidat položku
                  </button>
                )}
              </div>

              {data.polozky.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Žádné položky</p>
              )}

              {data.polozky.length > 0 && (
                <>
                  {/* Záhlaví sloupců */}
                  {editMode ? (
                    <div className="hidden md:flex gap-2 items-center text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 px-1">
                      <span className="flex-1 min-w-[120px]">Název</span>
                      <span className="w-28">Kategorie</span>
                      <span className="w-16">Množ.</span>
                      <span className="w-16">Jedn.</span>
                      <span className="w-24">Prod. Kč/j</span>
                      {jeMajitel && <span className="w-24">Nák. Kč/j</span>}
                      <span className="w-5" />
                    </div>
                  ) : (
                    <div className="hidden md:flex gap-2 items-center text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 px-1">
                      <span className="w-28 shrink-0">Kategorie</span>
                      <span className="flex-1">Položka</span>
                      <span className="w-28 text-right shrink-0">Množství</span>
                      <span className="w-28 text-right shrink-0">Celkem</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {editMode ? (
                      <>
                      {data.polozky.map((p, idx) => (
                        <div key={p.id} className="hidden md:flex gap-2 items-center text-sm">
                          <input value={p.nazev} onChange={e => aktualizujPolozku(idx, 'nazev', e.target.value)}
                            placeholder="Název" className="border border-gray-300 rounded px-2 py-1 flex-1 min-w-[120px]" />
                          <input value={p.kategorie} onChange={e => aktualizujPolozku(idx, 'kategorie', e.target.value)}
                            placeholder="Kategorie" className="border border-gray-300 rounded px-2 py-1 w-28" />
                          <input type="number"
                            min={CELOCISELNE_JEDNOTKY.has(p.jednotka) ? 1 : 0}
                            step={CELOCISELNE_JEDNOTKY.has(p.jednotka) ? 1 : 0.01}
                            value={p.mnozstvi}
                            onFocus={e => e.target.select()}
                            onChange={e => {
                              const n = parseFloat(e.target.value);
                              if (!isNaN(n)) aktualizujPolozku(idx, 'mnozstvi', CELOCISELNE_JEDNOTKY.has(p.jednotka) ? Math.max(1, Math.round(n)) : Math.max(0, n));
                            }}
                            className="border border-gray-300 rounded px-2 py-1 w-16" />
                          <input value={p.jednotka} onChange={e => aktualizujPolozku(idx, 'jednotka', e.target.value)}
                            placeholder="hod" className="border border-gray-300 rounded px-2 py-1 w-16" />
                          <input type="number" value={p.cena_za_jednotku} onChange={e => aktualizujPolozku(idx, 'cena_za_jednotku', +e.target.value)}
                            onFocus={e => e.target.select()}
                            className="border border-gray-300 rounded px-2 py-1 w-24" placeholder="Prod. Kč/j" />
                          {jeMajitel && (
                            <input type="number" value={p.nakupni_cena ?? 0} onChange={e => aktualizujPolozku(idx, 'nakupni_cena', +e.target.value)}
                              onFocus={e => e.target.select()}
                              className="border border-amber-300 rounded px-2 py-1 w-24 focus:border-amber-500" placeholder="Nák. Kč/j" />
                          )}
                          <button onClick={() => setData(d => ({ ...d, polozky: d.polozky.filter((_, i) => i !== idx) }))}
                            className="text-red-400 hover:text-red-600">✕</button>
                        </div>
                      ))}
                      {/* Mobile: karty s gridem */}
                      {data.polozky.map((p, idx) => (
                        <div key={`m-${p.id}`} className="md:hidden bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                            <div className="col-span-2">
                              <label className="text-xs text-gray-400">Název</label>
                              <input value={p.nazev} onChange={e => aktualizujPolozku(idx, 'nazev', e.target.value)}
                                placeholder="Název" className="w-full border border-gray-300 rounded px-2 py-1" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400">Kategorie</label>
                              <input value={p.kategorie} onChange={e => aktualizujPolozku(idx, 'kategorie', e.target.value)}
                                placeholder="Kategorie" className="w-full border border-gray-300 rounded px-2 py-1" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400">Množství</label>
                              <input type="number"
                                min={CELOCISELNE_JEDNOTKY.has(p.jednotka) ? 1 : 0}
                                step={CELOCISELNE_JEDNOTKY.has(p.jednotka) ? 1 : 0.01}
                                value={p.mnozstvi}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const n = parseFloat(e.target.value);
                                  if (!isNaN(n)) aktualizujPolozku(idx, 'mnozstvi', CELOCISELNE_JEDNOTKY.has(p.jednotka) ? Math.max(1, Math.round(n)) : Math.max(0, n));
                                }}
                                className="w-full border border-gray-300 rounded px-2 py-1" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400">Jednotka</label>
                              <input value={p.jednotka} onChange={e => aktualizujPolozku(idx, 'jednotka', e.target.value)}
                                placeholder="hod" className="w-full border border-gray-300 rounded px-2 py-1" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400">Prodej Kč/j</label>
                              <input type="number" value={p.cena_za_jednotku} onChange={e => aktualizujPolozku(idx, 'cena_za_jednotku', +e.target.value)}
                                onFocus={e => e.target.select()}
                                className="w-full border border-gray-300 rounded px-2 py-1" placeholder="Kč" />
                            </div>
                            {jeMajitel && (
                              <div>
                                <label className="text-xs text-gray-400">Nákup Kč/j</label>
                                <input type="number" value={p.nakupni_cena ?? 0} onChange={e => aktualizujPolozku(idx, 'nakupni_cena', +e.target.value)}
                                  onFocus={e => e.target.select()}
                                  className="w-full border border-amber-300 rounded px-2 py-1 focus:border-amber-500" placeholder="Kč" />
                              </div>
                            )}
                          </div>
                          <button onClick={() => setData(d => ({ ...d, polozky: d.polozky.filter((_, i) => i !== idx) }))}
                            className="text-red-400 hover:text-red-600 text-xs">✕ Odebrat</button>
                        </div>
                      ))}
                      </>
                    ) : (() => {
                      // Seřadit dle kategorie (prázdná na konec), pak dle názvu
                      const sorted = [...data.polozky].sort((a, b) => {
                        const ka = a.kategorie || '\uffff';
                        const kb = b.kategorie || '\uffff';
                        const katCmp = ka.localeCompare(kb, 'cs');
                        if (katCmp !== 0) return katCmp;
                        return a.nazev.localeCompare(b.nazev, 'cs');
                      });
                      // Seskupit dle kategorie
                      const skupiny: { kat: string; polozky: typeof sorted }[] = [];
                      for (const p of sorted) {
                        const kat = p.kategorie || '';
                        const last = skupiny[skupiny.length - 1];
                        if (last && last.kat === kat) { last.polozky.push(p); }
                        else { skupiny.push({ kat, polozky: [p] }); }
                      }
                      return skupiny.map(({ kat, polozky: grp }) => (
                          <div key={kat || '__bez_kategorie'} className="mb-2">
                            {grp.map((p, i) => (
                              <Fragment key={p.id}>
                                {/* Desktop */}
                                <div className="hidden md:flex gap-2 items-center text-sm py-0.5">
                                  <span className="w-28 shrink-0 text-xs text-gray-400 font-medium truncate">{i === 0 ? (kat || '—') : ''}</span>
                                  <span className="flex-1 text-gray-800 min-w-0">{p.nazev || '—'}</span>
                                  <span className="text-gray-600 w-28 text-right shrink-0">{p.mnozstvi} {p.jednotka}</span>
                                  <span className="font-medium text-gray-800 w-28 text-right shrink-0">{(p.mnozstvi * p.cena_za_jednotku).toLocaleString('cs-CZ')} Kč</span>
                                </div>
                                {/* Mobile */}
                                <div className="md:hidden flex justify-between items-baseline text-sm py-0.5 gap-2">
                                  <div className="min-w-0">
                                    <span className="text-gray-800">{p.nazev || '—'}</span>
                                    <span className="text-xs text-gray-400 ml-1.5">{p.mnozstvi} {p.jednotka}</span>
                                    {i === 0 && kat && <span className="text-xs text-amber-700 font-medium ml-1.5">{kat}</span>}
                                  </div>
                                  <span className="font-medium text-gray-800 shrink-0">{(p.mnozstvi * p.cena_za_jednotku).toLocaleString('cs-CZ')} Kč</span>
                                </div>
                              </Fragment>
                            ))}
                          </div>
                        ));
                    })()}
                  </div>

                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200 font-bold text-green-800">
                    <span>Celkem</span>
                    <span>{celkem.toLocaleString('cs-CZ')} Kč</span>
                  </div>
                </>
              )}
            </section>

            {/* Interní panel marže — pouze pro majitelku */}
            {jeMajitel && data.polozky.length > 0 && (() => {
              // Seřadit dle kategorie (prázdná na konec), pak dle názvu
              const sorted = [...data.polozky].sort((a, b) => {
                const ka = a.kategorie || '\uffff';
                const kb = b.kategorie || '\uffff';
                const katCmp = ka.localeCompare(kb, 'cs');
                if (katCmp !== 0) return katCmp;
                return a.nazev.localeCompare(b.nazev, 'cs');
              });
              // Seskupit dle kategorie
              const skupiny: { kat: string; polozky: typeof sorted }[] = [];
              for (const p of sorted) {
                const kat = p.kategorie || '';
                const last = skupiny[skupiny.length - 1];
                if (last && last.kat === kat) { last.polozky.push(p); }
                else { skupiny.push({ kat, polozky: [p] }); }
              }
              const celkemNakup  = data.polozky.reduce((s, p) => s + (p.nakupni_cena ?? 0) * p.mnozstvi, 0);
              const celkemProdej = data.polozky.reduce((s, p) => s + p.cena_za_jednotku * p.mnozstvi, 0);
              const celkemMarzeKc = celkemProdej - celkemNakup;
              const celkemMarzePct = celkemProdej > 0 ? (celkemMarzeKc / celkemProdej) * 100 : 0;
              return (
                <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <h3 className="font-semibold text-amber-800 text-sm uppercase tracking-wide mb-3">🔒 Interní kalkulace marže</h3>
                  {/* Desktop: tabulka */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs font-semibold text-amber-700 uppercase tracking-wide border-b border-amber-200">
                          <th className="text-left py-1.5 pr-3">Kategorie</th>
                          <th className="text-left py-1.5 pr-3">Položka</th>
                          <th className="text-right py-1.5 px-2">Nákup</th>
                          <th className="text-right py-1.5 px-2">Prodej</th>
                          <th className="text-right py-1.5 px-2">Marže Kč</th>
                          <th className="text-right py-1.5 pl-2">Marže %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skupiny.map(({ kat, polozky: grp }) => (
                            <Fragment key={kat || '__bez_kategorie'}>
                              {grp.map((p, i) => {
                                const nakup  = (p.nakupni_cena ?? 0) * p.mnozstvi;
                                const prodej = p.cena_za_jednotku * p.mnozstvi;
                                const marzeKc  = prodej - nakup;
                                const marzePct = prodej > 0 ? (marzeKc / prodej) * 100 : 0;
                                return (
                                  <tr key={p.id} className="border-b border-amber-100">
                                    <td className="py-1.5 pr-3 text-xs text-amber-700 font-medium truncate max-w-[100px]">{i === 0 ? (kat || '—') : ''}</td>
                                    <td className="py-1.5 pr-3 text-gray-700 truncate max-w-[140px]">{p.nazev || '—'}</td>
                                    <td className="text-right py-1.5 px-2 text-gray-600">{nakup > 0 ? nakup.toLocaleString('cs-CZ') + ' Kč' : <span className="text-gray-300">—</span>}</td>
                                    <td className="text-right py-1.5 px-2 text-gray-800">{prodej.toLocaleString('cs-CZ')} Kč</td>
                                    <td className={`text-right py-1.5 px-2 font-medium ${marzeKc >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                      {nakup > 0 ? (marzeKc >= 0 ? '+' : '') + marzeKc.toLocaleString('cs-CZ') + ' Kč' : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className={`text-right py-1.5 pl-2 font-medium ${marzePct >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                      {nakup > 0 ? marzePct.toFixed(1) + ' %' : <span className="text-gray-300">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </Fragment>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-amber-300 font-bold text-amber-900">
                          <td className="pt-2 pr-3" colSpan={2}>Celkem</td>
                          <td className="text-right pt-2 px-2">{celkemNakup > 0 ? celkemNakup.toLocaleString('cs-CZ') + ' Kč' : '—'}</td>
                          <td className="text-right pt-2 px-2">{celkemProdej.toLocaleString('cs-CZ')} Kč</td>
                          <td className={`text-right pt-2 px-2 ${celkemMarzeKc >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {celkemNakup > 0 ? (celkemMarzeKc >= 0 ? '+' : '') + celkemMarzeKc.toLocaleString('cs-CZ') + ' Kč' : '—'}
                          </td>
                          <td className={`text-right pt-2 pl-2 ${celkemMarzePct >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {celkemNakup > 0 ? celkemMarzePct.toFixed(1) + ' %' : '—'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {/* Mobile: karty */}
                  <div className="md:hidden space-y-2">
                    {skupiny.map(({ kat, polozky: grp }) => (
                      <div key={kat || '__bez_kategorie'}>
                        {grp.map((p, i) => {
                          const nakup  = (p.nakupni_cena ?? 0) * p.mnozstvi;
                          const prodej = p.cena_za_jednotku * p.mnozstvi;
                          const marzeKc  = prodej - nakup;
                          const marzePct = prodej > 0 ? (marzeKc / prodej) * 100 : 0;
                          return (
                            <div key={p.id} className={`rounded-lg p-2.5 mb-1.5 ${i === 0 ? 'mt-1' : ''} bg-white/60`}>
                              <div className="text-gray-700 text-sm truncate">
                                {i === 0 && kat && <span className="text-xs text-amber-700 font-medium mr-1">{kat} ·</span>}
                                {p.nazev || '—'}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mt-1">
                                {nakup > 0 && <span className="text-gray-500">Nákup {nakup.toLocaleString('cs-CZ')} Kč</span>}
                                <span className="text-gray-700">Prodej {prodej.toLocaleString('cs-CZ')} Kč</span>
                              </div>
                              {nakup > 0 && (
                                <div className={`text-sm font-medium mt-0.5 ${marzeKc >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                  {marzeKc >= 0 ? '+' : ''}{marzeKc.toLocaleString('cs-CZ')} Kč ({marzePct.toFixed(1)} %)
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <div className="border-t-2 border-amber-300 pt-2 font-bold text-amber-900 text-sm space-y-0.5">
                      <div className="flex justify-between">
                        <span>Nákup celkem</span>
                        <span>{celkemNakup > 0 ? celkemNakup.toLocaleString('cs-CZ') + ' Kč' : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Prodej celkem</span>
                        <span>{celkemProdej.toLocaleString('cs-CZ')} Kč</span>
                      </div>
                      <div className={`flex justify-between ${celkemMarzeKc >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        <span>Marže celkem</span>
                        <span>{celkemNakup > 0 ? (celkemMarzeKc >= 0 ? '+' : '') + celkemMarzeKc.toLocaleString('cs-CZ') + ' Kč' : '—'}</span>
                      </div>
                      <div className={`flex justify-between ${celkemMarzePct >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        <span>Marže %</span>
                        <span>{celkemNakup > 0 ? celkemMarzePct.toFixed(1) + ' %' : '—'}</span>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })()}

            {!jeMajitel && !data.schvaleno_zakaznikem && data.stav === 'naceneno' && (
              <button onClick={handleSchvalit}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-2xl transition-colors text-base">
                ✅ Schválit zakázku
              </button>
            )}
          </div>
        ) : tab === 'projekt' ? (
          <div className="p-4 overflow-auto"><ProjektySekce zakazka_id={data.id} /></div>
        ) : (
          <KonverzacePanel zakazka_id={data.id} uzivatel={uzivatel} />
        )}
      </div>
    </div>
  );
}
