import { useState, useEffect, useCallback } from 'react';
import { Zakazka, StavZakazky } from '../types/garden';
import { getZakazky, upsertZakazka, deleteZakazka as dbDelete, generateId } from '../services/database';

export function useZakazky(filterEmail?: string) {
  const [zakazky, setZakazky] = useState<Zakazka[]>([]);

  const reload = useCallback(async () => {
    const vse = await getZakazky();
    const filtrovane = filterEmail
      ? vse.filter(z => z.zakaznik_email?.toLowerCase() === filterEmail.toLowerCase())
      : vse;
    setZakazky(filtrovane);
  }, [filterEmail]);

  useEffect(() => { reload(); }, [reload]);

  async function vytvorZakazku(data: Omit<Zakazka, 'id' | 'cislo' | 'datum_vytvoreni' | 'datum_aktualizace'>): Promise<Zakazka> {
    const vsechny = await getZakazky();
    const cislo = String(vsechny.length + 1).padStart(3, '0');
    const nova: Zakazka = {
      ...data,
      id: generateId(),
      cislo,
      datum_vytvoreni: new Date().toISOString(),
      datum_aktualizace: new Date().toISOString(),
    };
    await upsertZakazka(nova);
    await reload();
    return nova;
  }

  async function aktualizujZakazku(z: Zakazka): Promise<void> {
    await upsertZakazka({ ...z, datum_aktualizace: new Date().toISOString() });
    await reload();
  }

  async function smazZakazku(id: string): Promise<void> {
    await dbDelete(id);
    await reload();
  }

  async function schvalZakazku(id: string, jmeno: string): Promise<void> {
    const z = (await getZakazky()).find(x => x.id === id);
    if (!z) return;
    await aktualizujZakazku({
      ...z,
      stav: 'schvaleno' as StavZakazky,
      schvaleno_zakaznikem: true,
      datum_schvaleni: new Date().toISOString(),
      schvalil_jmeno: jmeno,
    });
  }

  return { zakazky, reload, vytvorZakazku, aktualizujZakazku, smazZakazku, schvalZakazku };
}
