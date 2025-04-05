import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ElectronStoreService } from '../../electron-store.service';
import { Router } from '@angular/router';
import { EncryptionService } from '../../services/EncryptionService';

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

  disconnect(): void {
    this.store.set("pseudo", "");
    this.router.navigateByUrl("/");
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

  // Méthode de soumission du formulaire
  sendToBackend(formData: FormData): void {
    this.encryptionService.sendToBackend(formData).subscribe({
      next: (data) => {
        console.log('✅ Réponse :', data);
        this.encryptionStatus = data.message;

        // si tu veux permettre le téléchargement du fichier chiffré :
        //this.downloadEncryptedFile(data.encryptedFileBase64, data.originalFilename + '.encrypted');
      },
      error: (err) => {
        console.error('❌ Erreur d\'envoi :', err);
        this.encryptionStatus = 'Erreur lors de l\'envoi au serveur.';
      }
    });
  }

/*

  downloadEncryptedFile(base64: string, filename: string): void {
    const binary = atob(base64);
    const byteArray = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      byteArray[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([byteArray]);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

*/

}



/*
    // Cette fonction peut simplement montrer que le processus est en cours
    this.encryptionStatus = 'Envoi du fichier au serveur pour chiffrement...';
    
    // Simuler un appel API (à remplacer par votre vrai appel)
    setTimeout(() => {
      this.encryptionStatus = 'Fichier envoyé avec succès! Chiffrement en cours...';
    }, 1000);

    setTimeout(() => {
      this.encryptionStatus = 'Fichier chiffrer avec succes, une copie chiffré a été crée a l\' dans votre dossier par défaut'
    }, 3000);
*/