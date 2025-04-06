import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ElectronStoreService } from '../../services/electron/electron-store.service';
import { Router } from '@angular/router';
import { EncryptionService } from '../../services/API/EncryptionService';

@Component({
  selector: 'app-security',
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './security.component.html',
})
export class SecurityComponent {
  selectedFile: File | null = null;
  fileName: string = '';
  encryptionType: string = 'AES';
  aesKey: string = '';
  publicKey: string = '';
  encryptionStatus: string = '';
  loading: boolean = false;
  advancedMode: boolean = false;
  contentFile: any = "";
  encryptedData: string | null = null;
  encryptedFilename: string = '';
  decryptingKey: string = '';

  constructor(
    private store: ElectronStoreService,
    private router: Router,
    private encryptionService: EncryptionService
  ) {}

  toggleAdvancedMode(): void {
    this.advancedMode = !this.advancedMode;
    if (!this.advancedMode) {
      this.encryptionType = 'AES';
    }
  }

  async disconnect(): Promise<void> {
    this.store.setUserData('currentUser', null);
    this.router.navigateByUrl('/');
  }

  handleFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      this.selectedFile = file;
      this.fileName = file.name;
  
      const reader = new FileReader();
  
      reader.onload = () => {
        const content = reader.result as string;
        this.contentFile = content;
      };
  
      reader.onerror = (error) => {
        console.error('❌ Erreur lors de la lecture du fichier', error);
      };
  
      reader.readAsText(file);
    }
  }

  encryptFile(): void {
    if (!this.selectedFile) return;
  
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('encryptionType', this.encryptionType);
    formData.append('aesKey', this.aesKey);
    formData.append('publicKey', this.publicKey);

    this.sendToBackend(formData);
  }  

  sendToBackend(formData: FormData): void {
    this.loading = !this.loading

    this.encryptionService.sendToBackend(formData).subscribe({
      next: (data) => {
        console.log('✅ Réponse :', data);
        this.encryptionStatus = data.message;

        const input = document.querySelector('#fileInput') as HTMLInputElement;
        if (input) input.value = '';
        this.selectedFile = null;
        this.fileName = "";
        
        this.encryptedData = data.encryptedFileBase64;
        this.encryptedFilename = data.originalFilename + '.encrypted';
        this.decryptingKey = data.aesKey;

        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Erreur d\'envoi :', err);
        this.encryptionStatus = 'Erreur lors de l\'envoi au serveur.';
        this.loading = false;
      }
    });
  }

  async downloadEncryptedFile(): Promise<void> {
    if (!this.encryptedData || !this.encryptedFilename) return;
    
    const user = await this.store.getCurrentUser();
    if(!user) return;
    const defaultFolder = user?.storagePath || '';
  
    (window as any).electronAPI
    .openSaveDialog(this.encryptedFilename, defaultFolder)
    .then((filePath: string | null) => {
      if (!filePath) return;

      return (window as any).electronAPI.saveEncryptedFile(filePath, this.encryptedData);
    })
    .then((res: any) => {
      if (res?.success) {
        this.encryptionStatus = '✅ Fichier sauvegardé : ' + res.path;
      } else {
        console.error('❌ Erreur de sauvegarde :', res?.error);
        this.encryptionStatus = 'Erreur lors de la sauvegarde';
      }
    })
    .catch((err: any) => {
      console.error('❌ Erreur inattendue :', err);
      this.encryptionStatus = 'Erreur inattendue lors de la sauvegarde';
    });
  }
  
}