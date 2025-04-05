const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    chooseDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

    openSaveDialog: (defaultFileName, defaultPath) =>
        ipcRenderer.invoke('dialog:saveEncryptedFile', defaultFileName, defaultPath),

    saveEncryptedFile: (filePath, base64Data) =>
        ipcRenderer.invoke('file:saveEncryptedFile', { filePath, base64Data })
});

contextBridge.exposeInMainWorld('electronStore', {
    get: (key) => ipcRenderer.invoke('electron-store-get', key),
    set: (key, value) => ipcRenderer.invoke('electron-store-set', key, value),
});