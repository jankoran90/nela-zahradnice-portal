import React, { useState, useEffect } from 'react';
import { getParametry, upsertParametr, deleteParametr, getCiselnaRada, updateCiselnaRada } from '../../services/database';

interface Parametr {
  id: string;
  typ: string;
  hodnota: string;
}

interface CiselnaRada {
  rok: number;
  posledni_cislo: number;
}

const TYP_LABELS: Record<string, string> = {
  kategorie: '📁 Kategorie',
  nazev: '🏷️ Názvy',
};

const TYP_ORDER = ['kategorie', 'nazev'];

const Parametry = () => {
  const [parametry, setParametry] = useState<Parametr[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aktivniTyp, setAktivniTyp] = useState('kategorie');
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [novaHodnota, setNovaHodnota] = useState('');
  const [adding, setAdding] = useState(false);
  const [rada, setRada] = useState<CiselnaRada[]>([]);
  const [editRadaRok, setEditRadaRok] = useState<number | null>(null);
  const [editRadaCislo, setEditRadaCislo] = useState('');

  const fetchParametry = async () => {
    try {
      const data = await getParametry();
      setParametry(data);
      setLoading(false);
      setError('');
    } catch (err: any) {
      setError('Chyba při načítání: ' + (err.message || 'Neznámá chyba'));
      setLoading(false);
    }
  };

  useEffect(() => { fetchParametry(); fetchRada(); }, []);

  const fetchRada = async () => {
    try {
      const data = await getCiselnaRada();
      setRada(data);
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat tento parametr?')) return;
    try {
      await deleteParametr(id);
      fetchParametry();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRename = async (id: string) => {
    if (!editValue.trim()) { setEditId(null); return; }
    const p = parametry.find(x => x.id === id);
    if (!p) return;
    try {
      await deleteParametr(id);
      await upsertParametr(`${p.typ}_${editValue.trim()}`, p.typ, { hodnota: editValue.trim() });
      setEditId(null);
      fetchParametry();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAdd = async () => {
    if (!novaHodnota.trim()) return;
    setAdding(true);
    const id = `${aktivniTyp}_${novaHodnota.trim()}`;
    try {
      await upsertParametr(id, aktivniTyp, { hodnota: novaHodnota.trim() });
      setNovaHodnota('');
      fetchParametry();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Načítám parametry…</div>;
  }

  const typy = [...new Set(parametry.map(p => p.typ))];
  const serazeneTypy = TYP_ORDER.filter(t => typy.includes(t)).concat(typy.filter(t => !TYP_ORDER.includes(t)));
  const filtrovane = parametry.filter(p => p.typ === aktivniTyp);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h2 className="text-lg font-bold text-green-800 mb-4">⚙️ Správa parametrů</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>
      )}

      {/* Podsekce - taby podle typu */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {serazeneTypy.map(typ => (
          <button
            key={typ}
            onClick={() => setAktivniTyp(typ)}
            className={`text-sm font-medium px-4 py-2 rounded-t-lg transition-colors border-b-2 -mb-px ${
              aktivniTyp === typ
                ? 'bg-green-50 text-green-800 border-green-600'
                : 'text-gray-500 hover:text-green-600 border-transparent'
            }`}
          >
            {TYP_LABELS[typ] || typ}
          </button>
        ))}
      </div>

      {/* Přidat nový */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={novaHodnota}
          onChange={e => setNovaHodnota(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={`Nový ${aktivniTyp}…`}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !novaHodnota.trim()}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {adding ? '…' : '+ Přidat'}
        </button>
      </div>

      {/* Seznam */}
      {filtrovane.length === 0 ? (
        <div className="text-gray-400 text-sm italic py-4 text-center">Žádné záznamy v této kategorii</div>
      ) : (
        <ul className="space-y-1">
          {filtrovane.map(p => (
            <li
              key={p.id}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-green-300 transition-colors"
            >
              {editId === p.id ? (
                <>
                  <input
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(p.id); if (e.key === 'Escape') setEditId(null); }}
                    className="flex-1 border border-green-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    autoFocus
                  />
                  <button onClick={() => handleRename(p.id)} className="text-green-600 hover:text-green-800 text-sm font-medium px-2">✓</button>
                  <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 text-sm px-2">✕</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-800">{p.hodnota}</span>
                  <button
                    onClick={() => { setEditId(p.id); setEditValue(p.hodnota); }}
                    className="text-gray-400 hover:text-blue-500 transition-colors text-sm px-1"
                    title="Přejmenovat"
                  >✏️</button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors text-sm px-1"
                    title="Smazat"
                  >🗑️</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Číselná řada faktur */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-bold text-green-800 mb-3">🔢 Číselná řada faktur</h3>
        <p className="text-xs text-gray-400 mb-3">Formát: RRRRNNNN (např. 20260001). Změna posledního čísla ovlivní další generovanou fakturu.</p>
        
        {rada.length === 0 ? (
          <div className="text-gray-400 text-sm italic py-2">Žádné záznamy — první faktura vytvoří řadu automaticky</div>
        ) : (
          <ul className="space-y-1">
            {rada.map(r => (
              <li
                key={r.rok}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-green-300 transition-colors"
              >
                {editRadaRok === r.rok ? (
                  <>
                    <span className="text-sm font-mono text-gray-600">{r.rok}</span>
                    <input
                      type="number"
                      value={editRadaCislo}
                      onChange={e => setEditRadaCislo(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          fetch(`/api/ciselna-rada/${r.rok}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ posledni_cislo: parseInt(editRadaCislo) }),
                          }).then(() => { setEditRadaRok(null); fetchRada(); });
                        }
                        if (e.key === 'Escape') setEditRadaRok(null);
                      }}
                      className="w-20 border border-green-400 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400"
                      autoFocus
                    />
                    <span className="text-xs text-gray-400">→ další: {r.rok}{String(parseInt(editRadaCislo) + 1).padStart(4, '0')}</span>
                    <button onClick={() => {
                      fetch(`/api/ciselna-rada/${r.rok}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ posledni_cislo: parseInt(editRadaCislo) }),
                      }).then(() => { setEditRadaRok(null); fetchRada(); });
                    }} className="text-green-600 hover:text-green-800 text-sm font-medium px-2">✓</button>
                    <button onClick={() => setEditRadaRok(null)} className="text-gray-400 hover:text-gray-600 text-sm px-2">✕</button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-mono text-gray-800">{r.rok}</span>
                    <span className="text-sm text-gray-500">— poslední:</span>
                    <span className="text-sm font-mono font-semibold">{r.rok}{String(r.posledni_cislo).padStart(4, '0')}</span>
                    <span className="text-xs text-gray-400">→ další: {r.rok}{String(r.posledni_cislo + 1).padStart(4, '0')}</span>
                    <button
                      onClick={() => { setEditRadaRok(r.rok); setEditRadaCislo(String(r.posledni_cislo)); }}
                      className="ml-auto text-gray-400 hover:text-blue-500 transition-colors text-sm px-1"
                      title="Upravit"
                    >✏️</button>
                    <button
                      onClick={() => {
                        if (!confirm(`Resetovat číselnou řadu pro rok ${r.rok}?`)) return;
                        fetch(`/api/ciselna-rada/${r.rok}`, { method: 'DELETE' })
                          .then(() => fetchRada());
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors text-sm px-1"
                      title="Smazat řadu"
                    >🗑️</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Parametry;
