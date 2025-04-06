const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    chooseDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    openSaveDialog: (defaultFileName, defaultPath) =>
        ipcRenderer.invoke('dialog:saveEncryptedFile', defaultFileName, defaultPath),
    saveEncryptedFile: (filePath, base64Data) =>
        ipcRenderer.invoke('file:saveEncryptedFile', { filePath, base64Data }),
    getFilesFromFolder: (folderPath) => ipcRenderer.invoke('get-files', folderPath),
});

contextBridge.exposeInMainWorld('electronStore', {
    getUserData: (userId) => ipcRenderer.invoke('electron-store-get-user-data', userId),
    setUserData: (userId, userData) => ipcRenderer.invoke('electron-store-set-user-data', userId, userData),
});