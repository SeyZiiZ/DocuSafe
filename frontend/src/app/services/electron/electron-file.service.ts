import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ElectronAPI, FileEntry, OperationResult, SearchResult, WriteTextOptions } from './electron-api';

export type { FileEntry, SearchResult } from './electron-api';

@Injectable({ providedIn: 'root' })
export class ElectronFileService {
  private filesSubject = new BehaviorSubject<FileEntry[]>([]);
  files$ = this.filesSubject.asObservable();

  constructor(private zone: NgZone) {}

  private get api(): ElectronAPI {
    if (!window.electronAPI) throw new Error('DocuSafe doit être lancé dans Electron');
    return window.electronAPI;
  }

  async loadFiles(folderPath: string) {
    const result = await this.list(folderPath);
    this.filesSubject.next(result);
  }

  async list(folderPath: string): Promise<FileEntry[]> {
    return this.api.getFilesFromFolder(folderPath);
  }

  search(rootFolder: string, query: string): Promise<SearchResult[]> {
    return this.api.searchFiles(rootFolder, query);
  }

  readBase64(filePath: string): Promise<string> {
    return this.api.readFileBase64(filePath);
  }

  readText(filePath: string): Promise<string> {
    return this.api.readTextFile(filePath);
  }

  writeText(options: WriteTextOptions): Promise<OperationResult> {
    return this.api.writeTextFile(options);
  }

  saveToFolder(folder: string, fileName: string, base64Data: string): Promise<OperationResult> {
    return this.api.saveFileToFolder(folder, fileName, base64Data);
  }

  /** Boîte « Enregistrer sous » puis écriture ; null si l'utilisateur annule. */
  async saveAs(defaultFileName: string, base64Data: string, defaultFolder?: string): Promise<OperationResult | null> {
    const filePath = await this.api.openSaveDialog(defaultFileName, defaultFolder);
    if (!filePath) return null;
    return this.api.saveEncryptedFile(filePath, base64Data);
  }

  importFiles(destFolder: string): Promise<string[]> {
    return this.api.importFiles(destFolder);
  }

  createFolder(parentFolder: string, name: string): Promise<OperationResult> {
    return this.api.createFolder(parentFolder, name);
  }

  rename(filePath: string, newName: string): Promise<OperationResult> {
    return this.api.renameFile(filePath, newName);
  }

  delete(filePath: string): Promise<OperationResult> {
    return this.api.deleteFile(filePath);
  }

  open(filePath: string): Promise<OperationResult> {
    return this.api.openFile(filePath);
  }

  showInFolder(filePath: string): Promise<void> {
    return this.api.showInFolder(filePath);
  }

  chooseDirectory(): Promise<string | undefined> {
    return this.api.chooseDirectory();
  }

  /** Surveille le dossier de stockage ; renvoie la fonction de désabonnement. */
  watch(rootFolder: string, onChange: () => void): () => void {
    if (!window.electronAPI) return () => {};
    this.api.watchFolder(rootFolder).catch(err => console.warn('Surveillance du dossier impossible', err));
    return this.api.onFolderChanged(() => this.zone.run(onChange));
  }
}
