import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FileEntry, SearchResult } from '../../services/electron/electron-file.service';
import { FileAction, FileActionEvent } from '../../services/file-actions.service';
import { isEditableFile, isEncryptedFile } from '../../utils/file-utils';
import icons from '../icons/icons';

@Component({
  selector: 'app-files-container',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './files-container.component.html',
})
export class FilesContainerComponent {
  @Input() title: string = 'Fichiers récents';
  @Input() currentPath!: string;
  @Input() files: (FileEntry | SearchResult)[] = [];
  @Input() emptyMessage: string = 'Aucun fichier dans ce dossier.';
  @Input() showFolderColumn: boolean = false;
  @Output() action = new EventEmitter<FileActionEvent>();

  openMenuFor: string | null = null;
  renamingPath: string | null = null;
  renameValue: string = '';
  confirmDeletePath: string | null = null;

  private readonly iconHtml: Record<'directory' | 'encryptedFile' | 'textFile' | 'file', SafeHtml>;

  constructor(
    private sanitizer: DomSanitizer,
    private host: ElementRef<HTMLElement>
  ) {
    this.iconHtml = {
      directory: this.sanitizeSVG(icons.directory),
      encryptedFile: this.sanitizeSVG(icons.encryptedFile),
      textFile: this.sanitizeSVG(icons.textFile),
      file: this.sanitizeSVG(icons.file),
    };
  }

  sanitizeSVG(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  @HostListener('document:click')
  closeMenu(): void {
    this.openMenuFor = null;
  }

  toggleMenu(event: MouseEvent, file: FileEntry): void {
    event.stopPropagation();
    this.openMenuFor = this.openMenuFor === file.path ? null : file.path;
  }

  iconFor(file: FileEntry): SafeHtml {
    if (file.isDirectory) return this.iconHtml.directory;
    if (isEncryptedFile(file.name)) return this.iconHtml.encryptedFile;
    if (isEditableFile(file.name)) return this.iconHtml.textFile;
    return this.iconHtml.file;
  }

  isEncrypted(file: FileEntry): boolean {
    return !file.isDirectory && isEncryptedFile(file.name);
  }

  isEditable(file: FileEntry): boolean {
    return !file.isDirectory && isEditableFile(file.name);
  }

  snippetOf(file: FileEntry | SearchResult): string | null {
    return 'snippet' in file ? file.snippet : null;
  }

  folderOf(file: FileEntry | SearchResult): string {
    return 'folder' in file ? (file.folder || 'Racine') : '';
  }

  emit(action: FileAction, file: FileEntry): void {
    this.openMenuFor = null;
    this.action.emit({ action, file });
  }

  /** Double-clic : dossier → navigation, texte → éditeur, chiffré → déchiffrement, sinon application par défaut. */
  openDefault(file: FileEntry): void {
    if (this.renamingPath === file.path) return;
    if (this.isEditable(file)) this.emit('edit', file);
    else if (this.isEncrypted(file)) this.emit('decrypt', file);
    else this.emit('open', file);
  }

  startRename(file: FileEntry): void {
    this.openMenuFor = null;
    this.renamingPath = file.path;
    this.renameValue = file.name;
    setTimeout(() => {
      const input = this.host.nativeElement.querySelector('.rename-input') as HTMLInputElement | null;
      input?.focus();
      input?.setSelectionRange(0, file.isDirectory ? file.name.length : Math.max(file.name.lastIndexOf('.'), 0) || file.name.length);
    });
  }

  confirmRename(file: FileEntry): void {
    if (this.renamingPath !== file.path) return;
    const newName = this.renameValue.trim();
    this.renamingPath = null;
    if (newName && newName !== file.name) {
      this.action.emit({ action: 'rename', file, newName });
    }
  }

  cancelRename(): void {
    this.renamingPath = null;
  }

  askDelete(file: FileEntry): void {
    this.openMenuFor = null;
    this.confirmDeletePath = file.path;
  }

  confirmDelete(file: FileEntry): void {
    this.confirmDeletePath = null;
    this.action.emit({ action: 'delete', file });
  }

  trackByPath(_: number, file: FileEntry): string {
    return file.path;
  }
}
