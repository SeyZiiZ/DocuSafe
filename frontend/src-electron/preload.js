const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    chooseDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    openSaveDialog: (defaultFileName, defaultPath) =>
        ipcRenderer.invoke('dialog:saveEncryptedFile', defaultFileName, defaultPath),
    saveEncryptedFile: (filePath, base64Data) =>
        ipcRenderer.invoke('file:saveEncryptedFile', { filePath, base64Data }),
    getFilesFromFolder: (folderPath) => ipcRenderer.invoke('get-files', folderPath),
    searchFiles: (rootFolder, query) => ipcRenderer.invoke('search:files', rootFolder, query),
    readFileBase64: (filePath) => ipcRenderer.invoke('file:readBase64', filePath),
    readTextFile: (filePath) => ipcRenderer.invoke('file:readText', filePath),
    writeTextFile: (options) => ipcRenderer.invoke('file:writeText', options),
    saveFileToFolder: (folder, fileName, base64Data) =>
        ipcRenderer.invoke('file:saveToFolder', { folder, fileName, base64Data }),
    importFiles: (destFolder) => ipcRenderer.invoke('file:import', destFolder),
    createFolder: (parentFolder, name) => ipcRenderer.invoke('file:createFolder', parentFolder, name),
    renameFile: (filePath, newName) => ipcRenderer.invoke('file:rename', filePath, newName),
    deleteFile: (filePath) => ipcRenderer.invoke('file:delete', filePath),
    openFile: (filePath) => ipcRenderer.invoke('file:open', filePath),
    showInFolder: (filePath) => ipcRenderer.invoke('file:showInFolder', filePath),
    watchFolder: (folderPath) => ipcRenderer.invoke('watch:folder', folderPath),
    onFolderChanged: (callback) => {
        const listener = (_, folder) => callback(folder);
        ipcRenderer.on('folder-changed', listener);
        return () => ipcRenderer.removeListener('folder-changed', listener);
    },
});

contextBridge.exposeInMainWorld('electronStore', {
    getUserData: (userId) => ipcRenderer.invoke('electron-store-get-user-data', userId),
    setUserData: (userId, userData) => ipcRenderer.invoke('electron-store-set-user-data', userId, userData),
    listUsers: () => ipcRenderer.invoke('electron-store-list-users'),
    renameUser: (oldPseudo, newPseudo) => ipcRenderer.invoke('electron-store-rename-user', oldPseudo, newPseudo),
    deleteUser: (pseudo) => ipcRenderer.invoke('electron-store-delete-user', pseudo),
    isUnlocked: (pseudo) => ipcRenderer.invoke('auth:isUnlocked', pseudo),
    verifyPassword: (pseudo, password) => ipcRenderer.invoke('auth:verifyPassword', pseudo, password),
    setPassword: (pseudo, currentPassword, newPassword) =>
        ipcRenderer.invoke('auth:setPassword', pseudo, currentPassword, newPassword),
    lock: (pseudo) => ipcRenderer.invoke('auth:lock', pseudo),
    getProfileKey: (pseudo) => ipcRenderer.invoke('profileKey:get', pseudo),
    createProfileKey: (pseudo, password) => ipcRenderer.invoke('profileKey:create', pseudo, password),
});
