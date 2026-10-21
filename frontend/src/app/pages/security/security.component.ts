import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ElectronStoreService } from '../../services/electron/electron-store.service';
import { ElectronFileService } from '../../services/electron/electron-file.service';
import { EncryptionService } from '../../services/API/EncryptionService';
import { DecryptionService } from '../../services/API/DecryptionService';
import { KeyService } from '../../services/API/KeyService';
import { KeyPairResponse } from '../../services/API/ApiConfig';
import {
  EncryptionMode, apiErrorMessage, base64ToBlob, basename, detectEncryptionMode, dirname, isEncryptedFile, textToBase64
} from '../../utils/file-utils';

type Tab = 'encrypt' | 'decrypt' | 'keys';
type EncryptMethod = 'profile' | 'generated' | 'password' | 'rsa';
type Destination = 'storage' | 'saveAs';

interface SourceFile {
  name: string;
  blob: Blob;
  path?: string; // présent quand le fichier vient du dossier DocuSafe
}

@Component({
  selector: 'app-security',
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './security.component.html',
})
export class SecurityComponent implements OnInit, OnDestroy {
  tab: Tab = 'encrypt';
  pseudo: string = '';
  storagePath: string = '';
  profileKey: string | null = null;
  backendAvailable: boolean = true;
  loading: boolean = false;
  errorMessage: string = '';
  copied: string = '';

  // Chiffrement
  source: SourceFile | null = null;
  encryptMethod: EncryptMethod = 'generated';
  password: string = '';
  publicKey: string = '';
  destination: Destination = 'storage';
  trashOriginal: boolean = false;
  encryptionStatus: string = '';
  encryptedData: string | null = null;
  encryptedFilename: string = '';
  decryptingKey: string = '';
  generatedPrivateKey: string = '';

  // Déchiffrement
  decryptSource: SourceFile | null = null;
  detectedMode: EncryptionMode | null = null;
  useProfileKey: boolean = true;
  decryptKey: string = '';
  privateKey: string = '';
  trashEncrypted: boolean = false;
  decryptionStatus: string = '';
  decryptedData: string | null = null;
  decryptedFilename: string = '';

  // Clés RSA
  generatedPair: KeyPairResponse | null = null;

  private routeSubscription?: Subscription;

  constructor(
    private store: ElectronStoreService,
    private fileService: ElectronFileService,
    private router: Router,
    private route: ActivatedRoute,
    private encryptionService: EncryptionService,
    private decryptionService: DecryptionService,
    private keyService: KeyService
  ) {}

  async ngOnInit(): Promise<void> {
    const user = await this.store.getCurrentUser();
    if (!user) return;

    this.pseudo = user.pseudo;
    this.storagePath = user.storagePath ?? '';
    this.profileKey = await this.store.getProfileKey(user.pseudo);
    if (this.profileKey) this.encryptMethod = 'profile';

    this.keyService.isBackendAvailable().subscribe(available => this.backendAvailable = available);

    this.routeSubscription = this.route.queryParamMap.subscribe(params => {
      const mode = params.get('mode');
      const file = params.get('file');
      if (mode === 'encrypt' || mode === 'decrypt' || mode === 'keys') this.tab = mode;
      if (file) this.loadFromStorage(file, mode === 'decrypt' || isEncryptedFile(file) ? 'decrypt' : 'encrypt');
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  async disconnect(): Promise<void> {
    await this.store.logout();
    this.router.navigateByUrl('/');
  }

  selectTab(tab: Tab): void {
    this.tab = tab;
    this.errorMessage = '';
  }

  // -------------------------------------------------------------------------
  // Sélection des fichiers
  // -------------------------------------------------------------------------

  handleFileChange(event: Event, target: 'encrypt' | 'decrypt'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setSource({ name: file.name, blob: file }, target);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent, target: 'encrypt' | 'decrypt'): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.setSource({ name: file.name, blob: file }, target);
  }

  private async loadFromStorage(filePath: string, target: 'encrypt' | 'decrypt'): Promise<void> {
    try {
      const base64 = await this.fileService.readBase64(filePath);
      this.tab = target;
      this.setSource({ name: basename(filePath), blob: base64ToBlob(base64), path: filePath }, target);
    } catch (err: any) {
      this.errorMessage = 'Impossible de lire le fichier : ' + (err?.message ?? err);
    }
  }

  private async setSource(source: SourceFile, target: 'encrypt' | 'decrypt'): Promise<void> {
    this.errorMessage = '';
    if (target === 'encrypt') {
      this.source = source;
      this.trashOriginal = false;
      this.encryptionStatus = '';
      this.encryptedData = null;
      return;
    }

    this.decryptSource = source;
    this.trashEncrypted = false;
    this.decryptionStatus = '';
    this.decryptedData = null;
    this.detectedMode = detectEncryptionMode(new Uint8Array(await source.blob.slice(0, 8).arrayBuffer()));
    this.useProfileKey = !!this.profileKey && this.detectedMode === 'AES_KEY';
  }

  // -------------------------------------------------------------------------
  // Chiffrement
  // -------------------------------------------------------------------------

  get canTrashOriginal(): boolean {
    // Avec une clé générée, l'original n'est supprimé qu'après que l'utilisateur a pu sauvegarder la clé.
    return !!this.source?.path && this.destination === 'storage'
      && (this.encryptMethod === 'profile' || this.encryptMethod === 'password'
        || (this.encryptMethod === 'rsa' && !!this.publicKey.trim()));
  }

  get encryptDisabled(): boolean {
    if (!this.source || this.loading) return true;
    if (this.encryptMethod === 'password') return this.password.length < 8;
    if (this.encryptMethod === 'profile') return !this.profileKey;
    return false;
  }

  encryptFile(): void {
    if (!this.source) return;

    const formData = new FormData();
    formData.append('file', this.source.blob, this.source.name);
    formData.append('encryptionType', this.encryptMethod === 'rsa' ? 'RSA' : 'AES');
    formData.append('aesKey', this.encryptMethod === 'profile' ? this.profileKey ?? ''
      : this.encryptMethod === 'password' ? this.password : '');
    formData.append('publicKey', this.encryptMethod === 'rsa' ? this.publicKey : '');

    this.sendToBackend(formData);
  }

  sendToBackend(formData: FormData): void {
    this.loading = true;
    this.errorMessage = '';

    this.encryptionService.sendToBackend(formData).subscribe({
      next: async (data) => {
        this.encryptionStatus = data.message;
        this.encryptedData = data.encryptedFileBase64;
        this.encryptedFilename = data.originalFilename + '.encrypted';
        this.decryptingKey = data.aesKey ?? '';
        this.generatedPrivateKey = data.privateKey ?? '';
        this.password = '';

        if (this.destination === 'storage') {
          await this.saveEncryptedToStorage();
        } else {
          await this.downloadEncryptedFile();
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Erreur d\'envoi :', err);
        this.errorMessage = apiErrorMessage(err);
        this.loading = false;
      }
    });
  }

  private async saveEncryptedToStorage(): Promise<void> {
    if (!this.encryptedData || !this.source) return;

    const folder = this.source.path ? dirname(this.source.path) : this.storagePath;
    const result = await this.fileService.saveToFolder(folder, this.encryptedFilename, this.encryptedData);
    if (!result.success) {
      this.errorMessage = 'Erreur lors de la sauvegarde : ' + result.error;
      return;
    }

    this.encryptedFilename = result.name ?? this.encryptedFilename;
    this.encryptionStatus = '✅ Fichier chiffré enregistré : ' + result.path;

    if (this.trashOriginal && this.canTrashOriginal && this.source.path) {
      const trashed = await this.fileService.delete(this.source.path);
      if (trashed.success) this.encryptionStatus += ' — original mis à la corbeille';
    }
    this.source = null;
  }

  async downloadEncryptedFile(): Promise<void> {
    if (!this.encryptedData || !this.encryptedFilename) return;

    try {
      const res = await this.fileService.saveAs(this.encryptedFilename, this.encryptedData, this.storagePath);
      if (!res) return;
      if (res.success) {
        this.encryptionStatus = '✅ Fichier sauvegardé : ' + res.path;
      } else {
        console.error('❌ Erreur de sauvegarde :', res.error);
        this.errorMessage = 'Erreur lors de la sauvegarde';
      }
    } catch (err: any) {
      console.error('❌ Erreur inattendue :', err);
      this.errorMessage = 'Erreur inattendue lors de la sauvegarde';
    }
  }

  // -------------------------------------------------------------------------
  // Déchiffrement
  // -------------------------------------------------------------------------

  get decryptDisabled(): boolean {
    if (!this.decryptSource || this.loading) return true;
    switch (this.detectedMode) {
      case 'RSA': return !this.privateKey.trim();
      case 'AES_KEY': return !this.useProfileKey && !this.decryptKey.trim();
      default: return !this.decryptKey;
    }
  }

  get keyLabel(): string {
    switch (this.detectedMode) {
      case 'AES_PASSWORD': return 'Mot de passe utilisé lors du chiffrement';
      case 'RSA': return 'Clé privée RSA (PEM)';
      case 'LEGACY': return 'Clé AES (ancien format DocuSafe)';
      default: return 'Clé AES (Base64)';
    }
  }

  async loadPrivateKeyFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.privateKey = await file.text();
    input.value = '';
  }

  async decryptFile(): Promise<void> {
    if (!this.decryptSource) return;

    const formData = new FormData();
    formData.append('file', this.decryptSource.blob, this.decryptSource.name);
    if (this.detectedMode === 'RSA') {
      formData.append('privateKey', this.privateKey);
    } else {
      formData.append('aesKey', this.useProfileKey && this.detectedMode === 'AES_KEY' ? this.profileKey ?? '' : this.decryptKey);
    }

    this.loading = true;
    this.errorMessage = '';
    try {
      const data = await firstValueFrom(this.decryptionService.sendToBackend(formData));
      this.decryptionStatus = data.message;
      this.decryptedData = data.decryptedFileBase64;
      this.decryptedFilename = data.originalFilename;
      this.decryptKey = '';

      if (this.destination === 'storage') await this.saveDecryptedToStorage();
      else await this.saveDecryptedAs();
    } catch (err) {
      this.errorMessage = apiErrorMessage(err);
    } finally {
      this.loading = false;
    }
  }

  private async saveDecryptedToStorage(): Promise<void> {
    if (!this.decryptedData || !this.decryptSource) return;

    const folder = this.decryptSource.path ? dirname(this.decryptSource.path) : this.storagePath;
    const result = await this.fileService.saveToFolder(folder, this.decryptedFilename, this.decryptedData);
    if (!result.success) {
      this.errorMessage = 'Erreur lors de la sauvegarde : ' + result.error;
      return;
    }
    this.decryptionStatus = '✅ Fichier déchiffré enregistré : ' + result.path;

    if (this.trashEncrypted && this.decryptSource.path) {
      const trashed = await this.fileService.delete(this.decryptSource.path);
      if (trashed.success) this.decryptionStatus += ' — fichier chiffré mis à la corbeille';
    }
    this.decryptSource = null;
    this.detectedMode = null;
  }

  async saveDecryptedAs(): Promise<void> {
    if (!this.decryptedData) return;
    const res = await this.fileService.saveAs(this.decryptedFilename, this.decryptedData, this.storagePath);
    if (res?.success) this.decryptionStatus = '✅ Fichier sauvegardé : ' + res.path;
    else if (res) this.errorMessage = 'Erreur lors de la sauvegarde : ' + res.error;
  }

  // -------------------------------------------------------------------------
  // Clés
  // -------------------------------------------------------------------------

  async generateKeyPair(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      this.generatedPair = await firstValueFrom(this.keyService.generateRsaKeyPair());
    } catch (err) {
      this.errorMessage = apiErrorMessage(err);
    } finally {
      this.loading = false;
    }
  }

  useGeneratedPublicKey(): void {
    if (!this.generatedPair) return;
    this.publicKey = this.generatedPair.publicKey;
    this.encryptMethod = 'rsa';
    this.selectTab('encrypt');
  }

  async saveKey(content: string, defaultName: string): Promise<void> {
    // Pas de dossier par défaut : une clé ne doit pas être rangée à côté des fichiers qu'elle protège.
    const res = await this.fileService.saveAs(defaultName, textToBase64(content));
    if (res && !res.success) this.errorMessage = 'Erreur lors de la sauvegarde : ' + res.error;
  }

  async copy(value: string, label: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    this.copied = label;
    setTimeout(() => this.copied = '', 2000);
  }
}
