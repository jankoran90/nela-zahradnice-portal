import { useState, useEffect } from 'react';
import { Zakazka, Uzivatel } from '../../types/garden';
import { useZakazky } from '../../hooks/useZakazky';
import { useAuth } from '../../hooks/useAuth';
import { getUzivatele } from '../../services/database';

interface Props {
  onHotovo: (z: Zakazka) => void;
  onZrusit: () => void;
  uzivatele?: Uzivatel[];
}

export function ZakazkaForm({ onHotovo, onZrusit, uzivatele: uzivateleProp }: Props) {
  const { vytvorZakazku } = useZakazky();
  const { vytvorZakaznika } = useAuth();
  const [nazev, setNazev] = useState('');
  const [vybranyZakaznikId, setVybranyZakaznikId] = useState('');
  const [jmeno, setJmeno] = useState('');
  const [email, setEmail] = useState('');
  const [adresa, setAdresa] = useState('');
  const [poznamka, setPoznamka] = useState('');
  const [uzivateleLocal, setUzivateleLocal] = useState<Uzivatel[]>([]);

  // Načti zákazníky pokud nejsou předány propsem
  const zakaznici = (uzivateleProp ?? uzivateleLocal).filter(u => u.role === 'zakaznik');
  useEffect(() => {
    if (!uzivateleProp) getUzivatele().then(setUzivateleLocal);
  }, [uzivateleProp]);

  // Při výběru ze seznamu předvyplň
  function handleVyberZakaznika(id: string) {
    setVybranyZakaznikId(id);
    if (id === '__novy') {
      setJmeno(''); setEmail('');
      return;
    }
    const z = zakaznici.find(u => u.id === id);
    if (z) { setJmeno(z.jmeno); setEmail(z.email); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Pokud je vybrán nový zákazník nebo není z seznamu, vytvoř ho
    const jeNovy = vybranyZakaznikId === '__novy' || (!vybranyZakaznikId && email.trim());
    if (jeNovy && email.trim()) {
      await vytvorZakaznika(email.trim(), jmeno.trim());
    }
    const nova = await vytvorZakazku({
      nazev: nazev.trim(),
      zakaznik_jmeno: jmeno.trim(),
      zakaznik_email: email.trim() || undefined,
      adresa: adresa.trim(),
      stav: 'poptavka',
      polozky: [],
      poznamka_interna: poznamka.trim() || undefined,
    });
    onHotovo(nova);
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onZrusit} className="text-gray-400 hover:text-green-600 text-xl">←</button>
        <h2 className="text-xl font-bold text-green-800">Nová zakázka</h2>
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Název zakázky *</label>
          <input value={nazev} onChange={e => setNazev(e.target.value)} required
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Např. Úprava zahrady – Nová Ves" />
        </div>

        {/* Výběr zákazníka */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Zákazník</label>
          <select
            value={vybranyZakaznikId}
            onChange={e => handleVyberZakaznika(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
          >
            <option value="">— vyberte zákazníka —</option>
            {zakaznici.map(u => (
              <option key={u.id} value={u.id}>{u.jmeno} ({u.email})</option>
            ))}
            <option value="__novy">+ Nový zákazník…</option>
          </select>
        </div>

        {/* Jméno + email — předvyplněné ze seznamu, nebo prázdné pro nového */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Jméno zákazníka *</label>
          <input value={jmeno} onChange={e => { setJmeno(e.target.value); setVybranyZakaznikId(''); }} required
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Jan Novák" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            E-mail zákazníka <span className="text-gray-400 font-normal">(pro přístup do portálu)</span>
          </label>
          <input type="email" value={email} onChange={e => { setEmail(e.target.value); setVybranyZakaznikId(''); }}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="jan@email.cz" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Adresa</label>
          <input value={adresa} onChange={e => setAdresa(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Nová Ves 12, 123 00" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Interní poznámka</label>
          <textarea value={poznamka} onChange={e => setPoznamka(e.target.value)} rows={3}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Zákazník preferuje pátek odpoledne…" />
        </div>
        <button type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl transition-colors">
          Vytvořit zakázku
        </button>
      </form>
    </div>
  );
}
