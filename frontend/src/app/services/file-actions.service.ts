import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ElectronFileService, FileEntry } from './electron/electron-file.service';

export type FileAction = 'open' | 'edit' | 'encrypt' | 'decrypt' | 'rename' | 'showInFolder' | 'delete';

export interface FileActionEvent {
  action: FileAction;
  file: FileEntry;
  newName?: string;
}

/** Actions communes aux listes de fichiers (accueil, documents, recherche). */
@Injectable({ providedIn: 'root' })
export class FileActionsService {
  constructor(
    private files: ElectronFileService,
    private router: Router
  ) {}

  /** Renvoie un message d'erreur, ou null si l'action a réussi. */
  async run({ action, file, newName }: FileActionEvent): Promise<string | null> {
    try {
      switch (action) {
        case 'open':
          if (file.isDirectory) {
            await this.router.navigate(['/documents'], { queryParams: { folder: file.path } });
            return null;
          }
          return (await this.files.open(file.path)).error ?? null;
        case 'edit':
          await this.router.navigate(['/editor'], { queryParams: { path: file.path } });
          return null;
        case 'encrypt':
        case 'decrypt':
          await this.router.navigate(['/security'], { queryParams: { mode: action, file: file.path } });
          return null;
        case 'rename':
          if (!newName || newName === file.name) return null;
          return (await this.files.rename(file.path, newName)).error ?? null;
        case 'showInFolder':
          await this.files.showInFolder(file.path);
          return null;
        case 'delete':
          return (await this.files.delete(file.path)).error ?? null;
      }
    } catch (err: any) {
      return err?.message ?? 'Action impossible';
    }
  }
}
