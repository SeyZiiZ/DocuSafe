import { Component, OnDestroy } from '@angular/core';
import { ElectronStoreService } from '../../services/electron/electron-store.service';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FeatureCardComponent } from '../../components/feature-card/feature-card.component';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { FilesContainerComponent } from '../../components/files-container/files-container.component';
import { ElectronFileService, FileEntry } from '../../services/electron/electron-file.service';
import { FileActionEvent, FileActionsService } from '../../services/file-actions.service';
import { isEncryptedFile } from '../../utils/file-utils';
import icons from '../../components/icons/icons';

const RECENT_FILES_COUNT = 8;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule, FeatureCardComponent, SidebarComponent, FilesContainerComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnDestroy {
  currentPath: string = '';
  pseudo: string = '';
  profileImageUrl: string = '';
  files: FileEntry[] = [];
  icons = icons;
  searchQuery: string = '';
  statusMessage: string = '';
  errorMessage: string = '';

  private subscription?: Subscription;
  private stopWatching?: () => void;

  constructor(
    private store: ElectronStoreService,
    private fileService: ElectronFileService,
    private fileActions: FileActionsService,
    private router: Router
  ) {}

  async ngOnInit() {
    const user = await this.store.getCurrentUser();
    if (!user) return;

    this.currentPath = user?.storagePath || '?'
    this.pseudo = user?.pseudo || 'Unknown ?';
    this.profileImageUrl = this.store.avatarOf(user);

    if (user.storagePath) {
      this.subscription = this.fileService.files$.subscribe(files => this.files = files);
      this.stopWatching = this.fileService.watch(user.storagePath, () => this.refresh());
      await this.refresh();
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.stopWatching?.();
  }

  get recentFiles(): FileEntry[] {
    const query = this.searchQuery.trim().toLowerCase();
    return this.files
      .filter(file => !file.isDirectory)
      .filter(file => !query || file.name.toLowerCase().includes(query))
      .sort((a, b) => b.modifiedMs - a.modifiedMs)
      .slice(0, RECENT_FILES_COUNT);
  }

  get encryptedCount(): number {
    return this.files.filter(file => !file.isDirectory && isEncryptedFile(file.name)).length;
  }

  get documentCount(): number {
    return this.files.filter(file => !file.isDirectory).length;
  }

  async refresh(): Promise<void> {
    try {
      await this.fileService.loadFiles(this.currentPath);
    } catch (err: any) {
      this.errorMessage = 'Impossible de lire le dossier : ' + (err?.message ?? err);
    }
  }

  /** Entrée dans la barre de recherche : recherche complète (noms et contenu) sur la page Documents. */
  searchEverywhere(): void {
    const query = this.searchQuery.trim();
    if (query) this.router.navigate(['/documents'], { queryParams: { q: query } });
  }

  async importFiles(): Promise<void> {
    try {
      const imported = await this.fileService.importFiles(this.currentPath);
      if (imported.length > 0) {
        this.showStatus(`${imported.length} fichier(s) importé(s)`);
        await this.refresh();
      }
    } catch (err: any) {
      this.errorMessage = err?.message ?? 'Import impossible';
    }
  }

  async onFileAction(event: FileActionEvent): Promise<void> {
    const error = await this.fileActions.run(event);
    this.errorMessage = error ?? '';
    if (!error && (event.action === 'rename' || event.action === 'delete')) await this.refresh();
  }

  async disconnect(): Promise<void> {
    await this.store.logout();
    this.router.navigateByUrl('/');
  }

  private showStatus(message: string): void {
    this.statusMessage = message;
    this.errorMessage = '';
    setTimeout(() => this.statusMessage = '', 3000);
  }
}
