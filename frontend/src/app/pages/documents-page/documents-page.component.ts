import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { FilesContainerComponent } from '../../components/files-container/files-container.component';
import { ElectronStoreService } from '../../services/electron/electron-store.service';
import { ElectronFileService, FileEntry, SearchResult } from '../../services/electron/electron-file.service';
import { FileActionEvent, FileActionsService } from '../../services/file-actions.service';
import { bytesToBase64, formatBytes, isEditableFile, isEncryptedFile, isSubPath, joinPath, relativeSegments } from '../../utils/file-utils';

type TypeFilter = 'all' | 'encrypted' | 'documents' | 'folders';
type SortKey = 'name' | 'modified' | 'size';

interface Breadcrumb {
  label: string;
  path: string;
}

@Component({
  selector: 'app-documents-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, FilesContainerComponent],
  templateUrl: './documents-page.component.html',
})
export class DocumentsPageComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  rootPath: string = '';
  currentFolder: string = '';
  entries: FileEntry[] = [];
  searchQuery: string = '';
  searchResults: SearchResult[] | null = null;
  searching: boolean = false;
  typeFilter: TypeFilter = 'all';
  sortKey: SortKey = 'name';
  creatingFolder: boolean = false;
  newFolderName: string = '';
  dragging: boolean = false;
  statusMessage: string = '';
  errorMessage: string = '';

  private searchTimer?: ReturnType<typeof setTimeout>;
  private searchRun = 0;
  private stopWatching?: () => void;
  private routeSubscription?: Subscription;

  constructor(
    private store: ElectronStoreService,
    private fileService: ElectronFileService,
    private fileActions: FileActionsService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const user = await this.store.getCurrentUser();
    if (!user?.storagePath) return;

    this.rootPath = user.storagePath;
    this.stopWatching = this.fileService.watch(this.rootPath, () => this.reload());

    this.routeSubscription = this.route.queryParamMap.subscribe(async params => {
      const folder = params.get('folder');
      this.currentFolder = folder && isSubPath(this.rootPath, folder) ? folder : this.rootPath;

      const query = params.get('q');
      if (query !== null && query !== this.searchQuery) {
        this.searchQuery = query;
        this.runSearch();
      }
      if (params.has('search')) setTimeout(() => this.searchInput?.nativeElement.focus());

      await this.loadFolder();
    });
  }

  ngOnDestroy(): void {
    this.stopWatching?.();
    this.routeSubscription?.unsubscribe();
    clearTimeout(this.searchTimer);
  }

  get breadcrumbs(): Breadcrumb[] {
    const crumbs: Breadcrumb[] = [{ label: 'Mes documents', path: this.rootPath }];
    let path = this.rootPath;
    for (const segment of relativeSegments(this.rootPath, this.currentFolder)) {
      path = joinPath(path, segment);
      crumbs.push({ label: segment, path });
    }
    return crumbs;
  }

  get visibleFiles(): (FileEntry | SearchResult)[] {
    const source = this.searchResults ?? this.entries;
    const filtered = source.filter(file => {
      switch (this.typeFilter) {
        case 'encrypted': return !file.isDirectory && isEncryptedFile(file.name);
        case 'documents': return !file.isDirectory && isEditableFile(file.name);
        case 'folders': return file.isDirectory;
        default: return true;
      }
    });

    return filtered.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      switch (this.sortKey) {
        case 'modified': return b.modifiedMs - a.modifiedMs;
        case 'size': return b.sizeBytes - a.sizeBytes;
        default: return a.name.localeCompare(b.name, 'fr', { numeric: true });
      }
    });
  }

  get stats(): string {
    const files = this.entries.filter(file => !file.isDirectory);
    const encrypted = files.filter(file => isEncryptedFile(file.name)).length;
    const folders = this.entries.length - files.length;
    const size = files.reduce((total, file) => total + file.sizeBytes, 0);
    return `${files.length} fichier(s), ${folders} dossier(s), ${encrypted} chiffré(s) — ${formatBytes(size)}`;
  }

  openFolder(path: string): void {
    this.clearSearch();
    this.router.navigate([], { queryParams: { folder: path === this.rootPath ? null : path } });
  }

  async loadFolder(): Promise<void> {
    try {
      this.entries = await this.fileService.list(this.currentFolder);
      this.errorMessage = '';
    } catch (err: any) {
      this.entries = [];
      this.errorMessage = 'Impossible de lire le dossier : ' + (err?.message ?? err);
    }
  }

  async reload(): Promise<void> {
    await this.loadFolder();
    if (this.searchResults) await this.runSearch();
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.runSearch(), 250);
  }

  async runSearch(): Promise<void> {
    const query = this.searchQuery.trim();
    if (!query) {
      this.searchResults = null;
      return;
    }

    const run = ++this.searchRun;
    this.searching = true;
    try {
      const results = await this.fileService.search(this.rootPath, query);
      if (run === this.searchRun) this.searchResults = results;
    } catch (err: any) {
      this.errorMessage = 'Recherche impossible : ' + (err?.message ?? err);
    } finally {
      if (run === this.searchRun) this.searching = false;
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = null;
    this.searchRun++;
    this.searching = false;
  }

  async importFiles(): Promise<void> {
    try {
      const imported = await this.fileService.importFiles(this.currentFolder);
      if (imported.length > 0) {
        this.showStatus(`${imported.length} fichier(s) importé(s)`);
        await this.loadFolder();
      }
    } catch (err: any) {
      this.errorMessage = err?.message ?? 'Import impossible';
    }
  }

  async createFolder(): Promise<void> {
    const name = this.newFolderName.trim();
    if (!name) return;

    const result = await this.fileService.createFolder(this.currentFolder, name);
    if (!result.success) {
      this.errorMessage = result.error ?? 'Création impossible';
      return;
    }
    this.creatingFolder = false;
    this.newFolderName = '';
    await this.loadFolder();
  }

  newDocument(): void {
    this.router.navigate(['/editor'], { queryParams: { folder: this.currentFolder } });
  }

  async onFileAction(event: FileActionEvent): Promise<void> {
    if (event.action === 'open' && event.file.isDirectory) {
      this.openFolder(event.file.path);
      return;
    }

    const error = await this.fileActions.run(event);
    this.errorMessage = error ?? '';
    if (!error && (event.action === 'rename' || event.action === 'delete')) await this.reload();
  }

  onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.dragging = true;
  }

  onDragLeave(event: DragEvent): void {
    if (event.currentTarget === event.target) this.dragging = false;
  }

  /** Glisser-déposer depuis l'explorateur : copie des fichiers dans le dossier courant. */
  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragging = false;
    const files = Array.from(event.dataTransfer?.files ?? []);

    let saved = 0;
    for (const file of files) {
      const base64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
      const result = await this.fileService.saveToFolder(this.currentFolder, file.name, base64);
      if (result.success) saved++;
      else this.errorMessage = result.error ?? 'Import impossible';
    }
    if (saved > 0) {
      this.showStatus(`${saved} fichier(s) ajouté(s)`);
      await this.loadFolder();
    }
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
