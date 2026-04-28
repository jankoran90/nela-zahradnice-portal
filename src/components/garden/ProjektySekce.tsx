import { useState, useRef } from 'react';
import { ProjektovySoubor, STITKY_SOUBORU } from '../../types/garden';
import { useSoubory } from '../../hooks/useSoubory';
import { getSouborUrl } from '../../services/database';

interface Props {
  zakazka_id: string;
}

export function ProjektySekce({ zakazka_id }: Props) {
  const { soubory, nahrat, smazat } = useSoubory(zakazka_id);
  const [uploading, setUploading] = useState(false);
  const [stitek, setStitek] = useState('');
  const [filtrStitek, setFiltrStitek] = useState('');
  const [galerie, setGalerie] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [menuSoubor, setMenuSoubor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const filtrovane = filtrStitek
    ? soubory.filter(s => s.stitek === filtrStitek)
    : soubory;

  const obrazky = filtrovane.filter(s => s.typ.startsWith('image/'));

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        await nahrat(f, stitek || undefined);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      if (camRef.current) camRef.current.value = '';
    }
  }

  function stitekBadge(val?: string | null) {
    const s = STITKY_SOUBORU.find(x => x.value === val);
    if (!s) return null;
    return <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${s.barva}`}>{s.emoji} {s.label}</span>;
  }

  function formatSize(bytes: number) {
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} kB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatDatum(iso: string) {
    return new Date(iso).toLocaleString('cs-CZ', {
      day: 'numeric', month: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">📎 Projektové soubory</span>
          <select
            value={filtrStitek}
            onChange={e => setFiltrStitek(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
          >
            <option value="">Všechny</option>
            {STITKY_SOUBORU.map(s => (
              <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">{soubory.length} souborů</span>
        </div>
        <div className="flex items-center gap-2">
          {obrazky.length > 0 && (
            <button onClick={() => setGalerie(!galerie)}
              className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                galerie ? 'bg-green-100 text-green-800' : 'text-gray-500 hover:text-green-600'
              }`}
            >🖼️ Galerie</button>
          )}
        </div>
      </div>

      {/* Upload lišta */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={stitek}
          onChange={e => setStitek(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="">Bez štítku</option>
          {STITKY_SOUBORU.map(s => (
            <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>
          ))}
        </select>
        <button onClick={() => camRef.current?.click()}
          disabled={uploading}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1.5 rounded-xl text-xs transition-colors disabled:opacity-40"
        >📷 Vyfotit</button>
        <button onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="bg-white hover:bg-green-50 border border-gray-300 text-gray-700 font-semibold px-3 py-1.5 rounded-xl text-xs transition-colors disabled:opacity-40"
        >📎 Nahrát soubor</button>
        {uploading && <span className="text-xs text-gray-400">⏳ Nahrávám…</span>}
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => handleUpload(e.target.files)} />
        <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden"
          onChange={e => handleUpload(e.target.files)} />
      </div>

      {/* Galerie obrázků */}
      {galerie && obrazky.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {obrazky.map(s => (
            <div key={s.id} className="relative group">
              <img
                src={getSouborUrl(s.id)}
                alt={s.nazev}
                onClick={() => setLightbox(s.id)}
                className="w-full aspect-square object-cover rounded-xl cursor-pointer border border-gray-200 hover:opacity-90 transition-opacity"
              />
              <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                {stitekBadge(s.stitek)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (() => {
        const s = soubory.find(x => x.id === lightbox);
        if (!s) return null;
        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
            <img src={getSouborUrl(s.id)} alt={s.nazev} className="max-w-full max-h-full rounded-xl" />
            <button className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300">✕</button>
          </div>
        );
      })()}

      {/* Seznam souborů */}
      {!galerie && (
        filtrovane.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Zatím žádné projektové soubory.</p>
        ) : (
          <div className="space-y-2">
            {filtrovane.map(s => {
              const jeObrazek = s.typ.startsWith('image/');
              return (
                <div key={s.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 hover:border-green-300 transition-colors relative">
                  {/* Náhled nebo ikona */}
                  {jeObrazek ? (
                    <img src={getSouborUrl(s.id)} alt={s.nazev}
                      className="w-12 h-12 object-cover rounded-lg shrink-0 cursor-pointer"
                      onClick={() => setLightbox(s.id)} />
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-lg shrink-0 text-xl">
                      {s.typ.includes('pdf') ? '📕' : s.typ.includes('sheet') || s.typ.includes('xls') ? '📊' : '📄'}
                    </div>
                  )}
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <a href={getSouborUrl(s.id)} target="_blank" rel="noopener"
                      className="text-sm font-medium text-gray-800 hover:text-green-600 truncate block">
                      {s.nazev}
                    </a>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{formatSize(s.velikost)}</span>
                      <span className="text-xs text-gray-400">· {formatDatum(s.datum_nahrani)}</span>
                      {stitekBadge(s.stitek)}
                    </div>
                  </div>
                  {/* Menu */}
                  <button onClick={() => setMenuSoubor(menuSoubor === s.id ? null : s.id)}
                    className="text-gray-400 hover:text-gray-600 px-1 shrink-0">⋯</button>
                  {menuSoubor === s.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuSoubor(null)} />
                      <div className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]"
                        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                        <a href={getSouborUrl(s.id)} download={s.nazev}
                          className="block px-3 py-1.5 text-xs hover:bg-gray-50">💾 Stáhnout</a>
                        <div className="border-t border-gray-100 my-1" />
                        <div className="px-3 py-1 text-xs text-gray-400 font-medium">Štítek</div>
                        {STITKY_SOUBORU.map(st => (
                          <button key={st.value} onClick={async () => {
                            // TODO: patch souboru backend — zatím jen lokální
                            setMenuSoubor(null);
                          }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${s.stitek === st.value ? 'font-bold' : ''}`}>
                            {st.emoji} {st.label}
                          </button>
                        ))}
                        <div className="border-t border-gray-100 my-1" />
                        <button onClick={async () => { await smazat(s.id); setMenuSoubor(null); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">🗑️ Smazat</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
