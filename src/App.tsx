import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useZakazky } from './hooks/useZakazky';
import { Login } from './components/garden/Login';
import { ZakazkyList } from './components/garden/ZakazkyList';
import { ZakazkaDetail } from './components/garden/ZakazkaDetail';
import { ZakazkaForm } from './components/garden/ZakazkaForm';
import { ZakazniciList } from './components/garden/ZakazniciList';
import { ZakaznikDetail } from './components/garden/ZakaznikDetail';
import { Zakazka, Uzivatel, Faktura } from './types/garden';
import { getUzivatele, getFaktury } from './services/database';
import Parametry from './components/garden/Parametry';
import { FakturyList } from './components/garden/FakturyList';
import { FakturaDetail } from './components/garden/FakturaDetail';
import { FakturaForm } from './components/garden/FakturaForm';

type View = 'seznam' | 'detail' | 'nova' | 'zakaznici' | 'zakaznik-detail' | 'parametry' | 'faktury' | 'faktura-detail' | 'faktura-nova';

export default function App() {
  const { uzivatel, prihlasit, odhlasit, aktivovatTokenem, vytvorZakaznika } = useAuth();
  const [view, setView] = useState<View>('seznam');
  const [aktivniZakazka, setAktivniZakazka] = useState<Zakazka | null>(null);
  const [aktivniZakaznik, setAktivniZakaznik] = useState<Uzivatel | null>(null);
  const [uzivatele, setUzivatele] = useState<Uzivatel[]>([]);
  const [aktivniFaktura, setAktivniFaktura] = useState<Faktura | null>(null);
  const [fakturaZakazka, setFakturaZakazka] = useState<Zakazka | undefined>(undefined);
  const [faktury, setFaktury] = useState<Faktura[]>([]);
  const token = new URLSearchParams(window.location.search).get('token') ?? undefined;
  const { zakazky, reload, smazZakazku } = useZakazky(
    uzivatel?.role === 'zakaznik' ? uzivatel.email : undefined
  );

  useEffect(() => { if (uzivatel) reload(); }, [uzivatel]);
  useEffect(() => { if (uzivatel?.role === 'majitel') { getUzivatele().then(setUzivatele); getFaktury().then(setFaktury); } }, [uzivatel]);

  if (!uzivatel) {
    return <Login onPrihlaseni={prihlasit} />;
  }

  return (
    <div className="min-h-screen bg-green-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌿</span>
          <span className="font-bold text-green-800 text-sm">Nela Zahradnice</span>
          {uzivatel.role === 'majitel' && (
            <div className="flex gap-1 ml-4">
              <button
                onClick={() => setView('seznam')}
                className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                  view === 'seznam' ? 'bg-green-100 text-green-800' : 'text-gray-500 hover:text-green-600'
                }`}
              >📋 Zakázky</button>
              <button
                onClick={() => setView('zakaznici')}
                className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                  view === 'zakaznici' || view === 'zakaznik-detail' ? 'bg-green-100 text-green-800' : 'text-gray-500 hover:text-green-600'
                }`}
              >👥 Zákazníci</button>
              <button
                onClick={() => setView('faktury')}
                className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                  view === 'faktury' || view === 'faktura-detail' || view === 'faktura-nova' ? 'bg-green-100 text-green-800' : 'text-gray-500 hover:text-green-600'
                }`}
              >📄 Faktury</button>
              <button
                onClick={() => setView('parametry')}
                className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                  view === 'parametry' ? 'bg-green-100 text-green-800' : 'text-gray-500 hover:text-green-600'
                }`}
              >⚙️ Parametry</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:block">
            {uzivatel.jmeno}
            <span className="ml-1 text-xs text-gray-400">
              ({uzivatel.role === 'majitel' ? 'majitelka' : 'zákazník'})
            </span>
          </span>
          <button onClick={odhlasit} className="text-sm text-gray-500 hover:text-red-500 transition-colors">
            Odhlásit
          </button>
        </div>
      </nav>
      <main className="flex-1 overflow-auto">
        {view === 'seznam' && (
          <ZakazkyList
            zakazky={zakazky}
            uzivatel={uzivatel}
            faktury={faktury}
            onVybrat={z => { setAktivniZakazka(z); setView('detail'); }}
            onNova={() => setView('nova')}
            onUpravit={z => { setAktivniZakazka(z); setView('detail'); }}
            onSmazat={async id => { await smazZakazku(id); reload(); }}
          />
        )}
        {view === 'nova' && (
          <ZakazkaForm
            onHotovo={z => { setAktivniZakazka(z); setView('detail'); }}
            onZrusit={() => setView('seznam')}
            uzivatele={uzivatele}
          />
        )}
        {view === 'detail' && aktivniZakazka && (
          <ZakazkaDetail
            zakazka={aktivniZakazka}
            uzivatel={uzivatel}
            uzivatele={uzivatele}
            faktury={faktury}
            onZpet={() => { reload(); setView('seznam'); }}
            onAktualizovana={z => setAktivniZakazka(z)}
            onSmazat={async id => { await smazZakazku(id); reload(); setView('seznam'); }}
            onFaktura={z => { setFakturaZakazka(z); setView('faktura-nova'); }}
          />
        )}
        {view === 'zakaznici' && (
          <ZakazniciList
            uzivatele={uzivatele}
            zakazky={zakazky}
            onVybrat={u => { setAktivniZakaznik(u); setView('zakaznik-detail'); }}
            onNovyZakaznik={async (email, jmeno) => {
              await vytvorZakaznika(email, jmeno);
              const refreshed = await getUzivatele();
              setUzivatele(refreshed);
            }}
          />
        )}
        {view === 'zakaznik-detail' && aktivniZakaznik && (
          <ZakaznikDetail
            zakaznik={aktivniZakaznik}
            zakazky={zakazky}
            onZpet={() => { getUzivatele().then(setUzivatele); setView('zakaznici'); }}
            onUlozeno={u => setAktivniZakaznik(u)}
          />
        )}
        {view === 'parametry' && <Parametry />}
        {view === 'faktury' && (
          <FakturyList
            uzivatel={uzivatel}
            zakazky={zakazky}
            onDetail={f => { setAktivniFaktura(f); setView('faktura-detail'); }}
            onNova={() => { setFakturaZakazka(undefined); setView('faktura-nova'); }}
          />
        )}
        {view === 'faktura-detail' && aktivniFaktura && (
          <FakturaDetail
            faktura={aktivniFaktura}
            uzivatel={uzivatel}
            zakazky={zakazky}
            onZpet={() => setView('faktury')}
            onAktualizovano={f => setAktivniFaktura(f)}
          />
        )}
        {view === 'faktura-nova' && (
          <FakturaForm
            uzivatel={uzivatel}
            zakazky={zakazky}
            predvolenaZakazka={fakturaZakazka}
            onHotovo={() => { setFakturaZakazka(undefined); getFaktury().then(setFaktury); setView('faktury'); }}
            onZrusit={() => { setFakturaZakazka(undefined); setView('faktury'); }}
          />
        )}
      </main>
    </div>
  );
}
