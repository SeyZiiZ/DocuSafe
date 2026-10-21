import { Component, ElementRef, HostListener, OnDestroy, OnInit, SecurityContext, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ElectronStoreService } from '../../services/electron/electron-store.service';
import { ElectronFileService } from '../../services/electron/electron-file.service';
import { basename, dirname, extensionOf, isSubPath, relativeSegments, stripExtension } from '../../utils/file-utils';

type DocumentExtension = '.html' | '.txt' | '.md';

interface ToolbarAction {
  label: string;
  title: string;
  command: string;
  value?: string;
  className?: string;
}

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './editor.component.html',
})
export class EditorComponent implements OnInit, OnDestroy {
  @ViewChild('richEditor', { static: true }) richEditor!: ElementRef<HTMLDivElement>;

  storagePath: string = '';
  folder: string = '';
  filePath: string | null = null;
  title: string = '';
  extension: string = '.html';
  plainText: string = '';
  dirty: boolean = false;
  saving: boolean = false;
  wordCount: number = 0;
  statusMessage: string = '';
  errorMessage: string = '';

  readonly extensions: { value: DocumentExtension; label: string }[] = [
    { value: '.html', label: 'Document riche (.html)' },
    { value: '.md', label: 'Markdown (.md)' },
    { value: '.txt', label: 'Texte brut (.txt)' },
  ];

  readonly toolbar: ToolbarAction[][] = [
    [
      { label: 'G', title: 'Gras (Ctrl+B)', command: 'bold', className: 'font-bold' },
      { label: 'I', title: 'Italique (Ctrl+I)', command: 'italic', className: 'italic' },
      { label: 'S', title: 'Souligné (Ctrl+U)', command: 'underline', className: 'underline' },
      { label: 'B', title: 'Barré', command: 'strikeThrough', className: 'line-through' },
    ],
    [
      { label: 'Titre 1', title: 'Titre 1', command: 'formatBlock', value: 'h1' },
      { label: 'Titre 2', title: 'Titre 2', command: 'formatBlock', value: 'h2' },
      { label: 'Titre 3', title: 'Titre 3', command: 'formatBlock', value: 'h3' },
      { label: '¶', title: 'Paragraphe', command: 'formatBlock', value: 'p' },
      { label: '❝', title: 'Citation', command: 'formatBlock', value: 'blockquote' },
    ],
    [
      { label: '• Liste', title: 'Liste à puces', command: 'insertUnorderedList' },
      { label: '1. Liste', title: 'Liste numérotée', command: 'insertOrderedList' },
      { label: '―', title: 'Séparateur', command: 'insertHorizontalRule' },
    ],
    [
      { label: '↶', title: 'Annuler (Ctrl+Z)', command: 'undo' },
      { label: '↷', title: 'Rétablir (Ctrl+Y)', command: 'redo' },
      { label: 'Effacer', title: 'Effacer la mise en forme', command: 'removeFormat' },
    ],
  ];

  private routeSubscription?: Subscription;

  constructor(
    private store: ElectronStoreService,
    private fileService: ElectronFileService,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const user = await this.store.getCurrentUser();
    if (!user?.storagePath) return;
    this.storagePath = user.storagePath;

    // Balises HTML simples (<b>, <i>…) plutôt que des styles en ligne, qui seraient retirés au rechargement.
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('defaultParagraphSeparator', false, 'p');

    this.routeSubscription = this.route.queryParamMap.subscribe(params => {
      const path = params.get('path');
      const folder = params.get('folder');
      if (path) {
        // Après le premier enregistrement, l'URL reçoit le chemin du document déjà ouvert : rien à recharger.
        if (path !== this.filePath) this.openDocument(path);
      } else {
        this.newDocument(folder && isSubPath(this.storagePath, folder) ? folder : this.storagePath);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  get isRich(): boolean {
    return this.extension === '.html' || this.extension === '.htm';
  }

  get location(): string {
    const segments = relativeSegments(this.storagePath, this.folder);
    return ['Mes documents', ...segments].join(' / ');
  }

  /** Utilisé par le garde de navigation : évite de perdre des modifications. */
  canLeave(): boolean {
    return !this.dirty || confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?');
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.save();
    }
  }

  private newDocument(folder: string): void {
    this.folder = folder;
    this.filePath = null;
    this.title = '';
    this.extension = '.html';
    this.plainText = '';
    this.richEditor.nativeElement.innerHTML = '';
    this.resetState();
  }

  private async openDocument(path: string): Promise<void> {
    try {
      const content = await this.fileService.readText(path);
      this.filePath = path;
      this.folder = dirname(path);
      this.extension = extensionOf(path);
      this.title = stripExtension(basename(path));

      if (this.isRich) {
        const body = new DOMParser().parseFromString(content, 'text/html').body.innerHTML;
        // Le contenu vient du disque : tout script ou gestionnaire d'événement est retiré.
        this.richEditor.nativeElement.innerHTML = this.sanitizer.sanitize(SecurityContext.HTML, body) ?? '';
        this.plainText = '';
      } else {
        this.plainText = content;
        this.richEditor.nativeElement.innerHTML = '';
      }
      this.resetState();
    } catch (err: any) {
      this.errorMessage = 'Impossible d\'ouvrir le document : ' + (err?.message ?? err);
    }
  }

  private resetState(): void {
    this.dirty = false;
    this.statusMessage = '';
    this.errorMessage = '';
    this.updateWordCount();
  }

  exec(action: ToolbarAction): void {
    this.richEditor.nativeElement.focus();
    document.execCommand(action.command, false, action.value);
    this.onContentChange();
  }

  onContentChange(): void {
    this.dirty = true;
    this.updateWordCount();
  }

  private updateWordCount(): void {
    const text = this.isRich ? this.richEditor.nativeElement.innerText : this.plainText;
    this.wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  async save(): Promise<void> {
    const title = this.title.trim();
    if (!title) {
      this.errorMessage = 'Donnez un titre au document';
      return;
    }
    if (this.saving) return;

    this.saving = true;
    this.errorMessage = '';
    try {
      const fileName = title + this.extension;
      const content = this.isRich ? this.toHtmlDocument(title) : this.plainText;

      if (this.filePath && basename(this.filePath) !== fileName) {
        const renamed = await this.fileService.rename(this.filePath, fileName);
        if (!renamed.success) throw new Error(renamed.error);
        this.filePath = renamed.path ?? this.filePath;
      }

      const result = this.filePath
        ? await this.fileService.writeText({ filePath: this.filePath, content, overwrite: true })
        : await this.fileService.writeText({ folder: this.folder, fileName, content, overwrite: false });
      if (!result.success) throw new Error(result.error);

      const isNew = !this.filePath;
      this.filePath = result.path ?? this.filePath;
      this.dirty = false;
      this.statusMessage = '✅ Enregistré à ' + new Date().toLocaleTimeString();
      if (isNew) {
        this.router.navigate([], { queryParams: { path: this.filePath }, replaceUrl: true });
      }
    } catch (err: any) {
      this.errorMessage = 'Enregistrement impossible : ' + (err?.message ?? err);
    } finally {
      this.saving = false;
    }
  }

  encryptDocument(): void {
    if (!this.filePath || this.dirty) return;
    this.router.navigate(['/security'], { queryParams: { mode: 'encrypt', file: this.filePath } });
  }

  createNew(): void {
    if (!this.canLeave()) return;
    this.dirty = false;
    this.router.navigate(['/editor'], { queryParams: { folder: this.folder } });
  }

  async disconnect(): Promise<void> {
    if (!this.canLeave()) return;
    this.dirty = false;
    await this.store.logout();
    this.router.navigateByUrl('/');
  }

  private toHtmlDocument(title: string): string {
    const escapedTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return [
      '<!DOCTYPE html>',
      '<html lang="fr">',
      '<head>',
      '<meta charset="utf-8">',
      `<title>${escapedTitle}</title>`,
      '</head>',
      '<body>',
      this.richEditor.nativeElement.innerHTML,
      '</body>',
      '</html>',
      '',
    ].join('\n');
  }
}
