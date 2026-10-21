const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { promisify } = require('util');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

// Permet d'isoler les données (tests, profil portable) : doit être fait avant de créer le Store.
if (process.env.DOCUSAFE_USER_DATA) {
  app.setPath('userData', process.env.DOCUSAFE_USER_DATA);
}

const Store = require('electron-store').default;

const store = new Store();
const scrypt = promisify(crypto.scrypt);

const isDev = !app.isPackaged && !process.argv.includes('--prod');
const DEV_URL = 'http://localhost:4200';
const APP_URL = 'app://docusafe/';
const RENDERER_DIR = path.join(__dirname, 'dist/docu-safe-frontend/browser');
const BACKEND_HEALTH_URL = 'http://127.0.0.1:8080/api/health';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

// ---------------------------------------------------------------------------
// Fenêtre
// ---------------------------------------------------------------------------

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'DocuSafe',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'src-electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // L'application ne doit jamais naviguer ailleurs ni ouvrir de nouvelle fenêtre.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(isDev ? DEV_URL : APP_URL)) event.preventDefault();
  });

  loadRenderer(win);
}

function loadRenderer(win) {
  if (!isDev) {
    win.loadURL(APP_URL);
    return;
  }
  // En développement, ng serve peut ne pas encore être prêt : on réessaie.
  win.loadURL(DEV_URL).catch(() => {
    if (!win.isDestroyed()) setTimeout(() => loadRenderer(win), 1000);
  });
}

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    let filePath = path.normalize(path.join(RENDERER_DIR, decodeURIComponent(pathname)));
    const insideRenderer = filePath.startsWith(RENDERER_DIR + path.sep);
    if (!insideRenderer || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(RENDERER_DIR, 'index.html'); // routes Angular
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

// ---------------------------------------------------------------------------
// Backend Java (lancé automatiquement hors développement)
// ---------------------------------------------------------------------------

let backendProcess = null;

function backendJarPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'docusafe-backend.jar')
    : path.join(__dirname, '..', 'backend', 'target', 'docusafe-backend.jar');
}

function javaExecutable() {
  const binary = process.platform === 'win32' ? 'java.exe' : 'java';
  const javaHome = process.env.JAVA_HOME;
  if (javaHome && fs.existsSync(path.join(javaHome, 'bin', binary))) {
    return path.join(javaHome, 'bin', binary);
  }
  return 'java';
}

function isBackendUp() {
  return new Promise((resolve) => {
    const req = http.get(BACKEND_HEALTH_URL, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startBackend() {
  if (isDev || await isBackendUp()) return;

  const jar = backendJarPath();
  if (!fs.existsSync(jar)) {
    console.warn('⚠️ Backend introuvable :', jar);
    return;
  }

  backendProcess = spawn(javaExecutable(), ['-jar', jar], { stdio: 'ignore', windowsHide: true });
  backendProcess.on('error', (err) => console.error('❌ Impossible de lancer le backend Java :', err.message));
  backendProcess.on('exit', () => { backendProcess = null; });
}

// ---------------------------------------------------------------------------
// Cycle de vie
// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    startBackend();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  backendProcess?.kill();
});

// ---------------------------------------------------------------------------
// Profils utilisateurs
// ---------------------------------------------------------------------------

// Champs gérés uniquement par le processus principal : jamais exposés au rendu.
const AUTH_FIELDS = ['passwordSalt', 'passwordVerifier', 'profileKey', 'profileKeyWrapped'];
const RESERVED_IDS = ['currentUser', '__proto__', 'constructor', 'prototype'];
const MIN_PASSWORD_LENGTH = 8;

// Profils déverrouillés pendant cette session et leurs clés de profil déchiffrées (en mémoire uniquement).
const unlockedSessions = new Set();
const unlockedKeys = new Map();

function getUsers() {
  return store.get('users') || {};
}

function saveUsers(users) {
  store.set('users', users);
}

function publicUser(user) {
  if (!user || typeof user !== 'object') return user;
  const { passwordSalt, passwordVerifier, profileKey, profileKeyWrapped, ...rest } = user;
  return { ...rest, hasPassword: !!passwordVerifier, hasProfileKey: !!(profileKey || profileKeyWrapped) };
}

function isValidPseudo(pseudo) {
  return typeof pseudo === 'string'
    && pseudo.trim() === pseudo
    && pseudo.length > 0
    && pseudo.length <= 40
    && !RESERVED_IDS.includes(pseudo);
}

function isUnlocked(pseudo) {
  const user = getUsers()[pseudo];
  return !!user && (!user.passwordVerifier || unlockedSessions.has(pseudo));
}

/** scrypt → 64 octets : 32 pour vérifier le mot de passe, 32 pour chiffrer la clé de profil. */
async function deriveSecrets(password, saltBase64) {
  const derived = await scrypt(password ?? '', Buffer.from(saltBase64, 'base64'), 64, {
    N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024,
  });
  return { verifier: derived.subarray(0, 32), wrappingKey: derived.subarray(32) };
}

async function checkPassword(user, password) {
  const { verifier, wrappingKey } = await deriveSecrets(password, user.passwordSalt);
  const ok = crypto.timingSafeEqual(verifier, Buffer.from(user.passwordVerifier, 'base64'));
  return ok ? wrappingKey : null;
}

function wrapKey(keyBase64, wrappingKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', wrappingKey, iv);
  const data = Buffer.concat([cipher.update(Buffer.from(keyBase64, 'base64')), cipher.final()]);
  return { iv: iv.toString('base64'), data: data.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

function unwrapKey(wrapped, wrappingKey) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', wrappingKey, Buffer.from(wrapped.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(wrapped.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(wrapped.data, 'base64')), decipher.final()]).toString('base64');
}

ipcMain.handle('electron-store-get-user-data', async (_, userId) => {
  const users = getUsers();
  return publicUser(users[userId]);
});

ipcMain.handle('electron-store-set-user-data', async (_, userId, userData) => {
  if (userId !== 'currentUser' && !isValidPseudo(userId)) return;

  const users = getUsers();
  if (userData == null) {
    delete users[userId];
  } else {
    const { hasPassword, hasProfileKey, ...data } = userData;
    const existing = users[userId] || {};
    for (const field of AUTH_FIELDS) {
      if (existing[field] !== undefined) data[field] = existing[field];
      else delete data[field];
    }
    users[userId] = data;
  }
  saveUsers(users);
});

ipcMain.handle('electron-store-list-users', async () => {
  return Object.entries(getUsers())
    .filter(([id, user]) => id !== 'currentUser' && user?.pseudo)
    .map(([, user]) => publicUser(user))
    .sort((a, b) => a.pseudo.localeCompare(b.pseudo));
});

ipcMain.handle('electron-store-rename-user', async (_, oldPseudo, newPseudo) => {
  const users = getUsers();
  if (!users[oldPseudo] || oldPseudo === 'currentUser') return { success: false, error: 'Profil introuvable' };
  if (!isValidPseudo(newPseudo)) return { success: false, error: 'Pseudo invalide' };
  if (users[newPseudo]) return { success: false, error: 'Ce pseudo est déjà pris' };

  users[newPseudo] = { ...users[oldPseudo], pseudo: newPseudo };
  delete users[oldPseudo];
  if (users.currentUser?.pseudo === oldPseudo) users.currentUser = { pseudo: newPseudo };
  saveUsers(users);

  if (unlockedSessions.delete(oldPseudo)) unlockedSessions.add(newPseudo);
  if (unlockedKeys.has(oldPseudo)) {
    unlockedKeys.set(newPseudo, unlockedKeys.get(oldPseudo));
    unlockedKeys.delete(oldPseudo);
  }
  return { success: true };
});

ipcMain.handle('electron-store-delete-user', async (_, pseudo) => {
  if (pseudo === 'currentUser') return;
  const users = getUsers();
  delete users[pseudo];
  if (users.currentUser?.pseudo === pseudo) delete users.currentUser;
  saveUsers(users);
  unlockedSessions.delete(pseudo);
  unlockedKeys.delete(pseudo);
});

ipcMain.handle('auth:isUnlocked', async (_, pseudo) => isUnlocked(pseudo));

ipcMain.handle('auth:verifyPassword', async (_, pseudo, password) => {
  const user = getUsers()[pseudo];
  if (!user) return false;
  if (!user.passwordVerifier) return true;

  const wrappingKey = await checkPassword(user, password);
  if (!wrappingKey) return false;

  unlockedSessions.add(pseudo);
  if (user.profileKeyWrapped) unlockedKeys.set(pseudo, unwrapKey(user.profileKeyWrapped, wrappingKey));
  return true;
});

ipcMain.handle('auth:setPassword', async (_, pseudo, currentPassword, newPassword) => {
  const users = getUsers();
  const user = users[pseudo];
  if (!user) return { success: false, error: 'Profil introuvable' };
  if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères` };
  }

  let profileKey = user.profileKey ?? null;
  if (user.passwordVerifier) {
    const wrappingKey = await checkPassword(user, currentPassword);
    if (!wrappingKey) return { success: false, error: 'Mot de passe actuel incorrect' };
    if (user.profileKeyWrapped) profileKey = unwrapKey(user.profileKeyWrapped, wrappingKey);
  }

  for (const field of AUTH_FIELDS) delete user[field];
  if (newPassword) {
    const salt = crypto.randomBytes(16).toString('base64');
    const { verifier, wrappingKey } = await deriveSecrets(newPassword, salt);
    user.passwordSalt = salt;
    user.passwordVerifier = verifier.toString('base64');
    if (profileKey) {
      user.profileKeyWrapped = wrapKey(profileKey, wrappingKey);
      unlockedKeys.set(pseudo, profileKey);
    }
    unlockedSessions.add(pseudo);
  } else if (profileKey) {
    user.profileKey = profileKey;
  }

  users[pseudo] = user;
  saveUsers(users);
  return { success: true };
});

ipcMain.handle('auth:lock', async (_, pseudo) => {
  unlockedSessions.delete(pseudo);
  unlockedKeys.delete(pseudo);
});

ipcMain.handle('profileKey:get', async (_, pseudo) => {
  const user = getUsers()[pseudo];
  return user?.profileKey ?? unlockedKeys.get(pseudo) ?? null;
});

ipcMain.handle('profileKey:create', async (_, pseudo, password) => {
  const users = getUsers();
  const user = users[pseudo];
  if (!user) return { success: false, error: 'Profil introuvable' };
  if (user.profileKey || user.profileKeyWrapped) return { success: true };

  const key = crypto.randomBytes(32).toString('base64');
  if (user.passwordVerifier) {
    const wrappingKey = await checkPassword(user, password);
    if (!wrappingKey) return { success: false, error: 'Mot de passe incorrect' };
    user.profileKeyWrapped = wrapKey(key, wrappingKey);
    unlockedKeys.set(pseudo, key);
  } else {
    user.profileKey = key;
  }

  saveUsers(users);
  return { success: true };
});

// ---------------------------------------------------------------------------
// Fichiers (limités au dossier de stockage du profil connecté)
// ---------------------------------------------------------------------------

const HIDDEN_FILES = ['desktop.ini', 'thumbs.db'];
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.html', '.htm', '.json', '.csv', '.xml', '.log', '.yml', '.yaml', '.ini', '.rtf',
]);
const MAX_SEARCH_FILE_SIZE = 2 * 1024 * 1024;
const MAX_SEARCH_RESULTS = 200;

// Chemins choisis par l'utilisateur dans une boîte « Enregistrer sous » : écriture autorisée.
const approvedSavePaths = new Set();

function storageRoot() {
  const users = getUsers();
  const pseudo = users.currentUser?.pseudo;
  if (!pseudo || !isUnlocked(pseudo)) return null;
  return users[pseudo]?.storagePath || null;
}

function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return !path.isAbsolute(relative) && relative.split(path.sep)[0] !== '..';
}

function resolveInStorage(target, { allowRoot = true } = {}) {
  const root = storageRoot();
  if (!root || typeof target !== 'string' || !isInside(root, target)) {
    throw new Error('Accès refusé : chemin hors du dossier DocuSafe');
  }
  const resolved = path.resolve(target);
  if (!allowRoot && resolved === path.resolve(root)) {
    throw new Error('Opération impossible sur le dossier racine');
  }
  return resolved;
}

function safeFileName(name) {
  const cleaned = path.basename(String(name ?? ''))
    .replace(/[\x00-\x1f<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/, '')
    .trim();
  return cleaned || 'document';
}

function uniquePath(folder, fileName) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let candidate = path.join(folder, fileName);
  for (let i = 1; fs.existsSync(candidate); i++) {
    candidate = path.join(folder, `${base} (${i})${ext}`);
  }
  return candidate;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' Mo';
  return (bytes / 1024 ** 3).toFixed(1) + ' Go';
}

function toEntry(folderPath, name) {
  const filePath = path.join(folderPath, name);
  const stats = fs.statSync(filePath);
  const isDirectory = stats.isDirectory();
  return {
    name,
    path: filePath,
    size: isDirectory ? '—' : formatSize(stats.size),
    sizeBytes: isDirectory ? 0 : stats.size,
    modified: new Date(stats.mtime).toLocaleString(),
    modifiedMs: stats.mtimeMs,
    isDirectory,
    extension: isDirectory ? '' : path.extname(name).toLowerCase(),
  };
}

function listEntries(folderPath) {
  return fs.readdirSync(folderPath)
    .filter(name => !name.startsWith('.') && !HIDDEN_FILES.includes(name.toLowerCase()))
    .flatMap(name => {
      try {
        return [toEntry(folderPath, name)];
      } catch {
        return []; // fichier verrouillé ou supprimé entre-temps
      }
    });
}

function normalizeText(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function htmlToText(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function snippetAround(text, index, length) {
  let start = Math.max(0, index - 60);
  let end = Math.min(text.length, index + length + 60);
  // L'extrait ne commence ni ne finit au milieu d'un mot
  while (start > 0 && /\S/.test(text[start - 1])) start--;
  while (end < text.length && /\S/.test(text[end])) end++;
  const excerpt = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return (start > 0 ? '… ' : '') + excerpt + (end < text.length ? ' …' : '');
}

function* walkFiles(folder, depth = 0) {
  if (depth > 6) return;
  for (const entry of listEntries(folder)) {
    yield entry;
    if (entry.isDirectory) yield* walkFiles(entry.path, depth + 1);
  }
}

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  return result.filePaths[0];
});

ipcMain.handle('get-files', async (_, folderPath) => {
  return listEntries(resolveInStorage(folderPath));
});

ipcMain.handle('search:files', async (_, rootFolder, query) => {
  const root = resolveInStorage(rootFolder);
  const needle = normalizeText(String(query ?? '').trim());
  if (!needle) return [];

  const results = [];
  for (const entry of walkFiles(root)) {
    let snippet = null;
    if (!entry.isDirectory && TEXT_EXTENSIONS.has(entry.extension) && entry.sizeBytes <= MAX_SEARCH_FILE_SIZE) {
      try {
        let text = await fs.promises.readFile(entry.path, 'utf8');
        if (entry.extension === '.html' || entry.extension === '.htm') text = htmlToText(text);
        const index = normalizeText(text).indexOf(needle);
        if (index >= 0) snippet = snippetAround(text, index, needle.length);
      } catch {
        // illisible : on garde seulement la correspondance sur le nom
      }
    }

    if (snippet || normalizeText(entry.name).includes(needle)) {
      results.push({
        ...entry,
        folder: path.relative(root, path.dirname(entry.path)),
        matchType: snippet ? 'content' : 'name',
        snippet,
      });
      if (results.length >= MAX_SEARCH_RESULTS) break;
    }
  }
  return results;
});

ipcMain.handle('file:readBase64', async (_, filePath) => {
  return (await fs.promises.readFile(resolveInStorage(filePath, { allowRoot: false }))).toString('base64');
});

ipcMain.handle('file:readText', async (_, filePath) => {
  return fs.promises.readFile(resolveInStorage(filePath, { allowRoot: false }), 'utf8');
});

ipcMain.handle('file:writeText', async (_, { folder, fileName, filePath, content, overwrite }) => {
  try {
    const target = filePath
      ? resolveInStorage(filePath, { allowRoot: false })
      : resolveInStorage(path.join(resolveInStorage(folder), safeFileName(fileName)), { allowRoot: false });
    if (!overwrite && fs.existsSync(target)) {
      return { success: false, error: 'Un fichier porte déjà ce nom' };
    }
    await fs.promises.writeFile(target, content, 'utf8');
    return { success: true, path: target };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file:saveToFolder', async (_, { folder, fileName, base64Data }) => {
  try {
    const target = uniquePath(resolveInStorage(folder), safeFileName(fileName));
    await fs.promises.writeFile(target, Buffer.from(base64Data, 'base64'));
    return { success: true, path: target, name: path.basename(target) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('dialog:saveEncryptedFile', async (event, defaultFileName, customFolderPath) => {
  const fileName = safeFileName(defaultFileName);
  const defaultSavePath = customFolderPath
    ? path.join(customFolderPath, fileName)
    : path.join(app.getPath('downloads'), fileName);
  const filters = fileName.endsWith('.encrypted')
    ? [{ name: 'Encrypted Files', extensions: ['encrypted'] }]
    : [{ name: 'Tous les fichiers', extensions: ['*'] }];

  const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    title: fileName.endsWith('.encrypted') ? 'Enregistrer le fichier chiffré' : 'Enregistrer le fichier',
    defaultPath: defaultSavePath,
    filters,
  });

  if (canceled || !filePath) return null;
  approvedSavePaths.add(path.resolve(filePath));
  return filePath;
});

ipcMain.handle('file:saveEncryptedFile', async (_, { filePath, base64Data }) => {
  try {
    const target = path.resolve(filePath);
    if (!approvedSavePaths.delete(target)) resolveInStorage(target, { allowRoot: false });

    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(target, buffer);
    return { success: true, path: target };
  } catch (err) {
    console.error('❌ Erreur lors de l\'écriture du fichier :', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file:import', async (event, destFolder) => {
  const dest = resolveInStorage(destFolder);
  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Importer des documents',
    properties: ['openFile', 'multiSelections'],
  });
  if (canceled) return [];

  const imported = [];
  for (const source of filePaths) {
    const target = uniquePath(dest, path.basename(source));
    await fs.promises.copyFile(source, target);
    imported.push(path.basename(target));
  }
  return imported;
});

ipcMain.handle('file:createFolder', async (_, parentFolder, name) => {
  try {
    const target = path.join(resolveInStorage(parentFolder), safeFileName(name));
    if (fs.existsSync(target)) return { success: false, error: 'Un élément porte déjà ce nom' };
    await fs.promises.mkdir(target);
    return { success: true, path: target };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file:rename', async (_, filePath, newName) => {
  try {
    const source = resolveInStorage(filePath, { allowRoot: false });
    const target = path.join(path.dirname(source), safeFileName(newName));
    if (target !== source && fs.existsSync(target)) {
      return { success: false, error: 'Un élément porte déjà ce nom' };
    }
    await fs.promises.rename(source, target);
    return { success: true, path: target };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file:delete', async (_, filePath) => {
  try {
    // Corbeille plutôt que suppression définitive : l'utilisateur peut restaurer.
    await shell.trashItem(resolveInStorage(filePath, { allowRoot: false }));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file:open', async (_, filePath) => {
  const error = await shell.openPath(resolveInStorage(filePath, { allowRoot: false }));
  return error ? { success: false, error } : { success: true };
});

ipcMain.handle('file:showInFolder', async (_, filePath) => {
  shell.showItemInFolder(resolveInStorage(filePath));
});

// ---------------------------------------------------------------------------
// Synchronisation temps réel : surveillance du dossier de stockage
// ---------------------------------------------------------------------------

const watchers = new Map();

ipcMain.handle('watch:folder', async (event, folderPath) => {
  const sender = event.sender;
  const isNewSender = !watchers.has(sender.id);
  watchers.get(sender.id)?.close();
  watchers.delete(sender.id);
  if (!folderPath) return;

  const root = resolveInStorage(folderPath);
  let timer = null;
  const watcher = fs.watch(root, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!sender.isDestroyed()) sender.send('folder-changed', root);
    }, 300);
  });
  watcher.on('error', () => watcher.close());
  watchers.set(sender.id, watcher);

  if (isNewSender) {
    sender.once('destroyed', () => {
      watchers.get(sender.id)?.close();
      watchers.delete(sender.id);
    });
  }
});
