import { useRef, useState, useEffect, useCallback } from 'react';
import type { DragEvent, ClipboardEvent } from 'react';
import { Uzivatel, ZpravaPriloha, StitekZpravy, STITKY_ZPRAVY } from '../../types/garden';
import { useZpravy } from '../../hooks/useZpravy';

interface Props {
  zakazka_id: string;
  uzivatel: Uzivatel;
}

export function KonverzacePanel({ zakazka_id, uzivatel }: Props) {
  const { zpravy, odeslat, upravit, smazat } = useZpravy(zakazka_id);
  const [text, setText] = useState('');
  const [soubory, setSoubory] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [odesilani, setOdesilani] = useState(false);
  const [stitek, setStitek] = useState<StitekZpravy | ''>('');
  const [filtrStitek, setFiltrStitek] = useState<StitekZpravy | ''>('');
  const [galerie, setGalerie] = useState(false);
  const [menuZprava, setMenuZprava] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [zpravy]);

  const pridatSoubory = useCallback((files: FileList | File[]) => {
    const pole = Array.from(files).filter(f => f.size < 5 * 1024 * 1024);
    setSoubory(prev => [...prev, ...pole]);
  }, []);

  function onDragOver(e: DragEvent) { e.preventDefault(); setDragging(true); }
  function onDragLeave() { setDragging(false); }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) pridatSoubory(e.dataTransfer.files);
  }

  function onPaste(e: ClipboardEvent) {
    const obrazky = Array.from(e.clipboardData.items)
      .filter(i => i.kind === 'file' && i.type.startsWith('image/'))
      .map(i => i.getAsFile())
      .filter(Boolean) as File[];
    if (obrazky.length) pridatSoubory(obrazky);
  }

  async function handleOdeslat(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && soubory.length === 0) return;
    setOdesilani(true);
    await odeslat(uzivatel, text.trim(), soubory, stitek || null);
    setText('');
    setSoubory([]);
    setStitek('');
    setOdesilani(false);
  }

  function formatDatum(iso: string) {
    return new Date(iso).toLocaleString('cs-CZ', {
      day: 'numeric', month: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  const filtrovane = filtrStitek
    ? zpravy.filter(z => z.stitek === filtrStitek)
    : zpravy;

  const vsechnyFotky = zpravy
    .flatMap(z => z.prilohy.filter(p => p.typ.startsWith('image/')))
    .map(p => p.data);

  function stitekBadge(val?: StitekZpravy | null) {
    const s = STITKY_ZPRAVY.find(x => x.value === val);
    if (!s) return null;
    return <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${s.barva}`}>{s.emoji} {s.label}</span>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">Interní poznámky</span>
          <select
            value={filtrStitek}
            onChange={e => setFiltrStitek(e.target.value as StitekZpravy | '')}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
          >
            <option value="">Všechny</option>
            {STITKY_ZPRAVY.map(s => (
              <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setGalerie(!galerie)}
          className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
            galerie ? 'bg-green-100 text-green-800' : 'text-gray-500 hover:text-green-600'
          }`}
        >
          {galerie ? '💬 Zprávy' : '🖼️ Galerie'}
        </button>
      </div>

      {/* Galerie fotek */}
      {galerie ? (
        <div className="flex-1 overflow-y-auto p-4">
          <GalerieFotek fotky={vsechnyFotky} />
        </div>
      ) : (
      /* Seznam zpráv */
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {filtrovane.length === 0 && (
            <p className="text-center text-gray-400 text-sm mt-8">
              Zatím žádné poznámky. Začněte konverzaci.
            </p>
          )}
          {filtrovane.map(z => {
            const jaMluvim = z.autor_id === uzivatel.id;
            return (
              <div key={z.id} className={`flex gap-3 ${jaMluvim ? 'flex-row-reverse' : ''} ${z.pinned ? 'ring-2 ring-green-300 rounded-2xl' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                  z.autor_role === 'majitel' ? 'bg-green-600' : 'bg-blue-500'
                }`}>
                  {z.autor_jmeno.charAt(0).toUpperCase()}
                </div>
                <div className={`max-w-[80%] flex flex-col gap-1 ${jaMluvim ? 'items-end' : 'items-start'} relative`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">
                      {z.autor_jmeno} · {formatDatum(z.datum)}
                    </span>
                    {z.pinned && <span className="text-xs">📌</span>}
                    {stitekBadge(z.stitek)}
                  </div>
                  {z.text && (
                    <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                      jaMluvim
                        ? 'bg-green-600 text-white rounded-tr-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                    }`}>
                      {z.text}
                    </div>
                  )}
                  {z.prilohy.map(p => <PrilohaView key={p.id} priloha={p} />)}
                  <button onClick={() => setMenuZprava(menuZprava === z.id ? null : z.id)}
                    className="text-gray-400 hover:text-gray-600 text-xs px-1 self-start shrink-0">⋯</button>
                  {menuZprava === z.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuZprava(null)} />
                      <div className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]"
                        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                        <button onClick={async () => { await upravit(z.id, { pinned: !z.pinned }); setMenuZprava(null); }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">{z.pinned ? '📌 Odepnout' : '📌 Připnout'}</button>
                        <button onClick={async () => { await smazat(z.id); setMenuZprava(null); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">🗑️ Smazat</button>
                        <div className="border-t border-gray-100 my-1" />
                        <div className="px-3 py-1 text-xs text-gray-400 font-medium">Štítek</div>
                        {STITKY_ZPRAVY.map(s => (
                          <button key={s.value} onClick={async () => { await upravit(z.id, { stitek: z.stitek === s.value ? null : s.value }); setMenuZprava(null); }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${z.stitek === s.value ? 'font-bold' : ''}`}>
                            {s.emoji} {s.label}
                          </button>
                        ))}
                        {z.stitek && (
                          <button onClick={async () => { await upravit(z.id, { stitek: null }); setMenuZprava(null); }}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">✕ Bez štítku</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Vstupní lišta */}
      <div
        className={`border-t border-gray-200 p-4 bg-white transition-colors shrink-0 ${
          dragging ? 'bg-green-50 border-green-400 border-2' : ''
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {dragging && (
          <div className="text-center text-green-600 text-sm font-medium mb-2">
            📎 Přetáhněte soubory sem
          </div>
        )}
        {soubory.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {soubory.map((f, i) => (
              <div key={i} className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1 text-xs">
                <span>{f.type.startsWith('image/') ? '🖼️' : '📄'}</span>
                <span className="max-w-[120px] truncate">{f.name}</span>
                <button onClick={() => setSoubory(p => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 ml-1">✕</button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleOdeslat} className="flex gap-2 items-end">
          <div className="flex-1 flex flex-col gap-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onPaste={onPaste}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleOdeslat(e as unknown as React.FormEvent);
                }
              }}
              rows={2}
              placeholder="Napište poznámku… (Enter = odeslat, Shift+Enter = nový řádek)"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <div className="flex items-center gap-2">
              <select
                value={stitek}
                onChange={e => setStitek(e.target.value as StitekZpravy | '')}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
              >
                <option value="">Bez štítku</option>
                {STITKY_ZPRAVY.map(s => (
                  <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => camRef.current?.click()}
              className="p-2.5 rounded-xl border border-gray-300 hover:bg-green-50 text-gray-500 hover:text-green-600 transition-colors"
              title="Vyfotit">📷</button>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="p-2.5 rounded-xl border border-gray-300 hover:bg-green-50 text-gray-500 hover:text-green-600 transition-colors"
              title="Přiložit soubor">📎</button>
            <button type="submit"
              disabled={odesilani || (!text.trim() && soubory.length === 0)}
              className="p-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {odesilani ? '⏳' : '➤'}
            </button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { if (e.target.files) pridatSoubory(e.target.files); e.target.value = ''; }} />
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden"
            onChange={e => { if (e.target.files) pridatSoubory(e.target.files); e.target.value = ''; }} />
        </form>
        <p className="text-xs text-gray-400 mt-1">Max. velikost souboru: 5 MB</p>
      </div>
    </div>
  );
}

// ── Galerie fotek ─────────────────────────────────────────
function GalerieFotek({ fotky }: { fotky: string[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (fotky.length === 0) {
    return <p className="text-center text-gray-400 text-sm mt-8">Žádné fotky v poznámkách.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {fotky.map((src, i) => (
          <img key={i} src={src} alt={`Fotka ${i + 1}`}
            onClick={() => setLightbox(i)}
            className="w-full aspect-square object-cover rounded-xl cursor-pointer border border-gray-200 hover:opacity-90 transition-opacity"
          />
        ))}
      </div>
      {lightbox !== null && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={fotky[lightbox]} alt="Zvětšená fotka" className="max-w-full max-h-full rounded-xl" />
          <div className="absolute bottom-6 flex gap-4">
            {lightbox > 0 && (
              <button onClick={e => { e.stopPropagation(); setLightbox(lightbox - 1); }}
                className="bg-white/20 text-white px-4 py-2 rounded-xl hover:bg-white/30">← Předchozí</button>
            )}
            {lightbox < fotky.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setLightbox(lightbox + 1); }}
                className="bg-white/20 text-white px-4 py-2 rounded-xl hover:bg-white/30">Další →</button>
            )}
          </div>
          <button onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300">✕</button>
        </div>
      )}
    </>
  );
}

// ── Příloha ───────────────────────────────────────────────
function PrilohaView({ priloha }: { priloha: ZpravaPriloha }) {
  const [lightbox, setLightbox] = useState(false);
  const jeObrazek = priloha.typ.startsWith('image/');

  if (jeObrazek) return (
    <>
      <img
        src={priloha.data}
        alt={priloha.nazev}
        onClick={() => setLightbox(true)}
        className="max-w-[200px] max-h-[160px] rounded-xl cursor-pointer object-cover border border-gray-200 hover:opacity-90 transition-opacity"
      />
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <img src={priloha.data} alt={priloha.nazev} className="max-w-full max-h-full rounded-xl" />
          <button className="absolute top-4 right-4 text-white text-2xl">✕</button>
        </div>
      )}
    </>
  );

  return (
    <a
      href={priloha.data}
      download={priloha.nazev}
      className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
    >
      <span>📄</span>
      <span className="max-w-[160px] truncate">{priloha.nazev}</span>
      <span className="text-gray-400">
        {priloha.velikost < 1024 * 1024
          ? `${(priloha.velikost / 1024).toFixed(0)} kB`
          : `${(priloha.velikost / 1024 / 1024).toFixed(1)} MB`}
      </span>
    </a>
  );
}
