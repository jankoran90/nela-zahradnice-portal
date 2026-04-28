import { useState, useCallback, useEffect } from 'react';
import { ProjektovySoubor } from '../types/garden';
import { getSoubory, uploadSoubory, deleteSoubor } from '../services/database';

export function useSoubory(zakazka_id: string) {
  const [soubory, setSoubory] = useState<ProjektovySoubor[]>([]);

  const reload = useCallback(async () => {
    const data = await getSoubory(zakazka_id);
    setSoubory(Array.isArray(data) ? data : []);
  }, [zakazka_id]);

  useEffect(() => { reload(); }, [reload]);

  async function nahrat(file: File, stitek?: string): Promise<void> {
    await uploadSoubory(zakazka_id, file, stitek);
    await reload();
  }

  async function smazat(id: string): Promise<void> {
    await deleteSoubor(id);
    await reload();
  }

  return { soubory, nahrat, smazat, reload };
}
