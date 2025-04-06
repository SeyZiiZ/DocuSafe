const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store').default;

const store = new Store();

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'src-electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL('http://localhost:4200');
}

app.whenReady().then(() => {
  createWindow();
});

ipcMain.handle('electron-store-get-user-data', async (_, userId) => {
  const users = store.get('users') || {};
  return users[userId];
});

ipcMain.handle('electron-store-set-user-data', async (_, userId, userData) => {
  const users = store.get('users') || {};
  users[userId] = userData;
  store.set('users', users);
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

ipcMain.handle('get-files', async (event, folderPath) => {
  const files = fs.readdirSync(folderPath);
  return files.map(file => {
    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);
    return {
      name: file,
      size: (stats.size / 1024).toFixed(1) + ' Ko',
      modified: new Date(stats.mtime).toLocaleString(),
    };
  });
});

ipcMain.handle('dialog:saveEncryptedFile', async (_, defaultFileName, customFolderPath) => {
  const defaultSavePath = customFolderPath
    ? path.join(customFolderPath, defaultFileName)
    : path.join(app.getPath('downloads'), defaultFileName);
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Enregistrer le fichier chiffré',
    defaultPath: defaultSavePath,
    filters: [{ name: 'Encrypted Files', extensions: ['encrypted'] }]
  });

  return canceled ? null : filePath;
});

ipcMain.handle('file:saveEncryptedFile', async (_, { filePath, base64Data }) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  } catch (err) {
    console.error('❌ Erreur lors de l\'écriture du fichier :', err);
    return { success: false, error: err.message };
  }
});