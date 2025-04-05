import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface FileEntry {
  name: string;
  size: string;
  modified: string;
}

declare global {
  interface Window {
    electronAPI: {
      getFilesFromFolder: (folderPath: string) => Promise<FileEntry[]>;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class ElectronFileService {
  private filesSubject = new BehaviorSubject<FileEntry[]>([]);
  files$ = this.filesSubject.asObservable();

  async loadFiles(folderPath: string) {
    const result = await window.electronAPI.getFilesFromFolder(folderPath);
    this.filesSubject.next(result);
  }
}