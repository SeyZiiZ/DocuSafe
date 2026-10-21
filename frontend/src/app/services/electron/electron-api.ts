export interface FileEntry {
  name: string;
  path: string;
  size: string;
  sizeBytes: number;
  modified: string;
  modifiedMs: number;
  isDirectory: boolean;
  extension: string;
}

export interface SearchResult extends FileEntry {
  folder: string;
  matchType: 'name' | 'content';
  snippet: string | null;
}

export interface OperationResult {
  success: boolean;
  path?: string;
  name?: string;
  error?: string;
}

export interface UserProfile {
  pseudo: string;
  storagePath: string | null;
  profileImage: string;
  createdAt: string;
  hasPassword?: boolean;
  hasProfileKey?: boolean;
}

export interface WriteTextOptions {
  filePath?: string;
  folder?: string;
  fileName?: string;
  content: string;
  overwrite: boolean;
}

export interface ElectronAPI {
  chooseDirectory: () => Promise<string | undefined>;
  openSaveDialog: (defaultFileName: string, defaultPath?: string) => Promise<string | null>;
  saveEncryptedFile: (filePath: string, base64Data: string) => Promise<OperationResult>;
  getFilesFromFolder: (folderPath: string) => Promise<FileEntry[]>;
  searchFiles: (rootFolder: string, query: string) => Promise<SearchResult[]>;
  readFileBase64: (filePath: string) => Promise<string>;
  readTextFile: (filePath: string) => Promise<string>;
  writeTextFile: (options: WriteTextOptions) => Promise<OperationResult>;
  saveFileToFolder: (folder: string, fileName: string, base64Data: string) => Promise<OperationResult>;
  importFiles: (destFolder: string) => Promise<string[]>;
  createFolder: (parentFolder: string, name: string) => Promise<OperationResult>;
  renameFile: (filePath: string, newName: string) => Promise<OperationResult>;
  deleteFile: (filePath: string) => Promise<OperationResult>;
  openFile: (filePath: string) => Promise<OperationResult>;
  showInFolder: (filePath: string) => Promise<void>;
  watchFolder: (folderPath: string | null) => Promise<void>;
  onFolderChanged: (callback: (folder: string) => void) => () => void;
}

export interface ElectronStoreAPI {
  getUserData: (userId: string) => Promise<any>;
  setUserData: (userId: string, userData: any) => Promise<void>;
  listUsers: () => Promise<UserProfile[]>;
  renameUser: (oldPseudo: string, newPseudo: string) => Promise<OperationResult>;
  deleteUser: (pseudo: string) => Promise<void>;
  isUnlocked: (pseudo: string) => Promise<boolean>;
  verifyPassword: (pseudo: string, password: string) => Promise<boolean>;
  setPassword: (pseudo: string, currentPassword: string | null, newPassword: string | null) => Promise<OperationResult>;
  lock: (pseudo: string) => Promise<void>;
  getProfileKey: (pseudo: string) => Promise<string | null>;
  createProfileKey: (pseudo: string, password?: string) => Promise<OperationResult>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    electronStore?: ElectronStoreAPI;
  }
}
