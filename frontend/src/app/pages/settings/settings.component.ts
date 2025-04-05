import { Component } from '@angular/core';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ElectronStoreService } from '../../services/electron/electron-store.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  pseudo: string = '';
  pseudoAvailable: boolean = true;
  profileImageUrl: string | null = null;
  selectedFile: File | null = null;
  successMessage: string = '';
  errorMessage: string = '';

  constructor(
    private store: ElectronStoreService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.pseudo = await this.store.get("pseudo") || 'Unknown ?';
    this.profileImageUrl = await this.store.get('profileImage') || '';
  }

  disconnect(): void {
    this.store.set("pseudo", "");
    this.router.navigateByUrl("/");
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      
      // Prévisualisation de l'image
      const reader = new FileReader();
      reader.onload = async (e) => {
        this.profileImageUrl = e.target?.result as string;
        await this.store.set('profileImage', this.profileImageUrl);
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  uploadProfileImage(): void {
    if (!this.selectedFile) return;
    
    // Simulez l'upload (à remplacer par un appel API réel)
    this.showSuccessMessage('Photo de profil mise à jour avec succès');
    this.selectedFile = null;
  }

  removeProfileImage(): void {
    // Simulez la suppression (à remplacer par un appel API réel)
    this.profileImageUrl = '/assets/images/default-avatar.png';
    this.store.set('profileImage', this.profileImageUrl);
    this.selectedFile = null;
    this.showSuccessMessage('Photo de profil supprimée');
  }

  updatePseudo(): void {
    if (!this.pseudo) return;
    
    try {
      this.store.set('pseudo', this.pseudo);
      this.showSuccessMessage('Nom d\'utilisateur mis à jour avec succès');
    } catch (error: any) {
      console.log("Erreur", error);
      this.showErrorMessage('Impossible de modifer le nom d\'utilisateur');
    }
  }

  private showSuccessMessage(message: string): void {
    this.successMessage = message;
    this.errorMessage = '';
    
    setTimeout(() => {
      this.successMessage = '';
    }, 3000);
  }

  private showErrorMessage(message: string): void {
    this.errorMessage = message;
    this.successMessage = '';
    
    setTimeout(() => {
      this.errorMessage = '';
    }, 3000);
  }
}