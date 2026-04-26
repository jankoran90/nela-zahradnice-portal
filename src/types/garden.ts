export type Role = 'majitel' | 'zakaznik';

export interface Uzivatel {
  id: string;
  email: string;
  jmeno: string;
  role: Role;
  heslo_hash: string;
  token?: string;
  token_pouzit?: boolean;
  datum_vytvoreni: string;
}

export type StavZakazky =
  | 'poptavka'
  | 'naceneno'
  | 'schvaleno'
  | 'rozpracovano'
  | 'dokonceno'
  | 'stornovano';

export interface PolozkaCeny {
  id: string;
  nazev: string;
  kategorie: string;          // dynamická — libovolný string
  mnozstvi: number;
  jednotka: string;
  cena_za_jednotku: number;   // prodejní cena (zobrazuje se zákazníkovi)
  nakupni_cena?: number;      // nákupní cena (interní, jen pro majitelku)
  poznamka?: string;
}

export interface Zakazka {
  id: string;
  cislo: string;
  nazev: string;
  zakaznik_jmeno: string;
  zakaznik_email?: string;
  adresa: string;
  stav: StavZakazky;
  datum_vytvoreni: string;
  datum_aktualizace: string;
  polozky: PolozkaCeny[];
  poznamka_interna?: string;
  schvaleno_zakaznikem?: boolean;
  datum_schvaleni?: string;
  schvalil_jmeno?: string;
}

export interface ZpravaPriloha {
  id: string;
  nazev: string;
  typ: string;
  data: string;
  velikost: number;
}

export type StitekZpravy = 'poznamka' | 'dotaz' | 'fotka_realizace' | 'reference' | 'status';

export interface Zprava {
  id: string;
  zakazka_id: string;
  autor_id: string;
  autor_jmeno: string;
  autor_role: Role;
  text: string;
  prilohy: ZpravaPriloha[];
  datum: string;
  precteno: boolean;
  stitek?: StitekZpravy | null;
  pinned?: boolean;
}

export interface ProjektovySoubor {
  id: string;
  zakazka_id: string;
  nazev: string;
  typ: string;
  velikost: number;
  stitek?: string | null;
  cesta: string;
  datum_nahrani: string;
}

// ── Faktury ───────────────────────────────────────────────
export type TypFaktury = 'zalohova' | 'konecna' | 'dobropis';
export type StavFaktury = 'vystavena' | 'odeslana' | 'zaplacena' | 'stornovana';

export interface FakturaPolozka {
  id: string;
  nazev: string;
  kategorie: string;
  mnozstvi: number;
  jednotka: string;
  cena_za_jednotku: number;
  celkova_cena: number;
}

export interface FakturaOsoba {
  jmeno: string;
  adresa: string;
  ico?: string;
  dic?: string;
  telefon?: string;
  email?: string;
  ucet?: string;
  iban?: string;
}

export interface Faktura {
  id: string;
  cislo: string;
  zakazka_id: string;
  typ: TypFaktury;
  stav: StavFaktury;
  datum_vystaveni: string;
  datum_splatnosti: string;
  datum_zaplaceni: string | null;
  variabilni_symbol: string;
  castka_celkem: number;
  poznamka: string;
  dodavatel: FakturaOsoba;
  odberatel: FakturaOsoba;
  polozky: FakturaPolozka[];
  datum_vytvoreni: string;
  datum_aktualizace: string;
}

export const TYPY_FAKTURY: { value: TypFaktury; label: string }[] = [
  { value: 'zalohova', label: 'Zálohová' },
  { value: 'konecna', label: 'Konečná' },
  { value: 'dobropis', label: 'Dobropis' },
];

export const STAVY_FAKTURY: { value: StavFaktury; label: string; barva: string }[] = [
  { value: 'vystavena', label: 'Vystavena', barva: 'bg-yellow-100 text-yellow-800' },
  { value: 'odeslana', label: 'Odeslána', barva: 'bg-blue-100 text-blue-800' },
  { value: 'zaplacena', label: 'Zaplacena', barva: 'bg-green-100 text-green-800' },
  { value: 'stornovana', label: 'Stornována', barva: 'bg-red-100 text-red-800' },
];

export const DEFAULT_DODAVATEL: FakturaOsoba = {
  jmeno: 'Nela Kořanová',
  adresa: 'Šemanovice 46, Kokořín 277 23',
  ico: '87672260',
  dic: 'CZ9052151251',
  telefon: '+420721137480',
  email: 'info@nelazahradnice.cz',
  ucet: '187672260/5500',
};

export const STITKY_ZPRAVY: { value: StitekZpravy; label: string; emoji: string; barva: string }[] = [
  { value: 'poznamka',       label: 'Poznámka',     emoji: '📝', barva: 'bg-gray-100 text-gray-700' },
  { value: 'dotaz',          label: 'Dotaz',        emoji: '❓', barva: 'bg-yellow-100 text-yellow-800' },
  { value: 'fotka_realizace', label: 'Realizace',   emoji: '📸', barva: 'bg-blue-100 text-blue-800' },
  { value: 'reference',      label: 'Reference',    emoji: '⭐', barva: 'bg-purple-100 text-purple-800' },
  { value: 'status',         label: 'Status',       emoji: '🔄', barva: 'bg-green-100 text-green-800' },
];

export const STITKY_SOUBORU: { value: string; label: string; emoji: string; barva: string }[] = [
  { value: 'finalni',       label: 'Finální',      emoji: '✅', barva: 'bg-green-100 text-green-800' },
  { value: 'rozpracovany',  label: 'Rozpracovaný', emoji: '🔧', barva: 'bg-yellow-100 text-yellow-800' },
  { value: 'varianta',      label: 'Varianta',     emoji: '🔀', barva: 'bg-purple-100 text-purple-800' },
  { value: 'smlouva',       label: 'Smlouva',      emoji: '📄', barva: 'bg-blue-100 text-blue-800' },
  { value: 'podklad',       label: 'Podklad',      emoji: '📋', barva: 'bg-gray-100 text-gray-700' },
];
