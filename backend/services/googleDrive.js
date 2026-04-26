import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('Google Drive JS module loaded');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Načti JSON credentials ze Service Account souboru
// Očekává se, že proměnná GOOGLE_APPLICATION_CREDENTIALS odkazuje na cestu k souboru,
// nebo se přečte ze stringu GOOGLE_SERVICE_ACCOUNT_JSON (Base64/JSON string)
// Alternativně lze použít klíčové soubory z .env.

let authClient = null;

/**
 * Načte autentifikaci pro Google Drive API.
 * Tato implementace předpokládá Service Account, který má přístup k nějaké sdílené složce.
 * @returns {Promise<import('google-auth-library').JWT>}
 */
async function getAuthClient() {
  if (authClient) {
    return authClient;
  }

  // Strategie 1: Přímý JSON key z proměnné prostředí (Base64 nebo plain JSON)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim() !== '') {
    let jsonKey;
    try {
      // Zkus Base64 dekód
      jsonKey = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString());
    } catch (e) {
      // Pokud to není Base64, použij plain JSON
      jsonKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    }

    authClient = new google.auth.JWT({
      email: jsonKey.client_email,
      key: jsonKey.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_APPLICATION_CREDENTIALS.trim() !== '') {
    // Strategie 2: Soubor na disku
    const keyPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    const jsonKey = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    authClient = new google.auth.JWT({
      email: jsonKey.client_email,
      key: jsonKey.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  } else {
    throw new Error(
      'Google Drive API není nakonfigurováno. Je třeba nastavit GOOGLE_SERVICE_ACCOUNT_JSON nebo GOOGLE_APPLICATION_CREDENTIALS v .env.'
    );
  }

  await authClient.authorize();
  return authClient;
}

/**
 * Získá instanci Google Drive API.
 * @returns {Promise<import('googleapis').google.drive_v3.Drive>}
 */
async function getDrive() {
  const auth = await getAuthClient();
  return google.drive({ version: 'v3', auth });
}

/**
 * Vypíše soubory a složky v dané složce na Google Drive.
 * @param {string} folderId – ID složky (nebo 'root' pro root)
 * @param {string} query – volitelný query pro File.list (např. "mimeType contains 'image/'")
 * @returns {Promise<Array<{ id: string, name: string, mimeType: string, webViewLink: string, icon: string }>>}
 */
export async function listFolder(folderId = 'root', query = '') {
  const drive = await getDrive();

  const fullQuery = [
    `'${folderId}' in parents`,
    'trashed = false',
    query || ''
  ]
    .filter(Boolean)
    .join(' and ');

  const response = await drive.files.list({
    q: fullQuery,
    fields: 'files(id, name, mimeType, webViewLink, webContentLink, size, createdTime, modifiedTime)',
    orderBy: 'folder, name',
  });

  const files = response.data.files || [];

  // Mapujeme na frontend-friendly formát
  return files.map(file => {
    let icon = '📄';
    if (file.mimeType === 'application/vnd.google-apps.folder') icon = '📁';
    else if (file.mimeType.startsWith('image/')) icon = '🖼️';
    else if (file.mimeType.includes('pdf')) icon = '📕';
    else if (file.mimeType.includes('spreadsheet')) icon = '📊';
    else if (file.mimeType.includes('document')) icon = '📝';

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      downloadUrl: file.webContentLink,
      size: file.size ? Math.round(parseInt(file.size) / 1024) + ' KB' : null,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      icon,
    };
  });
}

/**
 * Vyhledá složku podle názvu ve výchozím rootu nebo dané složce.
 * @param {string} folderName – název složky (přesná shoda)
 * @param {string} parentId – výchozí 'root'
 * @returns {Promise<string|null>} – ID složky nebo null
 */
export async function findFolderByName(folderName, parentId = 'root') {
  const drive = await getDrive();
  const response = await drive.files.list({
    q: `'${parentId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
  });

  return response.data.files[0]?.id || null;
}

/**
 * Vytvoří instanci autentifikace pro testovací účely.
 * @returns {Promise<{ ready: boolean, error?: string }>}
 */
export async function testConnection() {
  try {
    const drive = await getDrive();
    // Zkusíme získat základní informace o root složce
    await drive.files.list({
      q: "'root' in parents",
      fields: 'files(id, name)',
      pageSize: 1,
    });
    return { ready: true };
  } catch (error) {
    return {
      ready: false,
      error: error.message || 'Neznámá chyba',
    };
  }
}

export default {
  listFolder,
  findFolderByName,
  testConnection,
};