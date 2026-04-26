import { useState, useCallback, useEffect } from 'react';
import { Zprava, ZpravaPriloha, Uzivatel, StitekZpravy } from '../types/garden';
import { getZpravy, saveZprava, patchZprava, deleteZprava, generateId } from '../services/database';

export function useZpravy(zakazka_id: string) {
  const [zpravy, setZpravy] = useState<Zprava[]>([]);

  const reload = useCallback(async () => {
    const data = await getZpravy(zakazka_id);
    setZpravy(Array.isArray(data) ? data : []);
  }, [zakazka_id]);

  useEffect(() => { reload(); }, [reload]);

  async function odeslat(autor: Uzivatel, text: string, soubory: File[], stitek?: StitekZpravy | null): Promise<void> {
    const prilohy: ZpravaPriloha[] = await Promise.all(soubory.map(fileToBase64));
    await saveZprava({
      id: generateId(),
      zakazka_id,
      autor_id: autor.id,
      autor_jmeno: autor.jmeno,
      autor_role: autor.role,
      text,
      prilohy,
      datum: new Date().toISOString(),
      precteno: false,
      stitek: stitek || null,
      pinned: false,
    });
    await reload();
  }

  async function upravit(id: string, data: { stitek?: StitekZpravy | null; pinned?: boolean }): Promise<void> {
    await patchZprava(id, data);
    await reload();
  }

  async function smazat(id: string): Promise<void> {
    await deleteZprava(id);
    await reload();
  }

  return { zpravy, odeslat, upravit, smazat, reload };
}

async function fileToBase64(file: File): Promise<ZpravaPriloha> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: Date.now().toString(36),
      nazev: file.name,
      typ: file.type,
      data: reader.result as string,
      velikost: file.size,
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
