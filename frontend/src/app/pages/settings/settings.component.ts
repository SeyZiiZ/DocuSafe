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
    const user = await this.store.getCurrentUser();
    if (!user) return;
  
    this.pseudo = user?.pseudo || 'Unknown ?';
    this.profileImageUrl = user?.profileImage || '/assets/images/default-avatar.png';
  }

  async disconnect(): Promise<void> {
    this.store.setUserData('currentUser', null);
    this.router.navigateByUrl('/');
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        this.profileImageUrl = e.target?.result as string;
        const current = await this.store.getUserData('currentUser');
        const pseudo = current?.pseudo;
        if (!pseudo) return;
  
        const user = await this.store.getUserData(pseudo);
        if (!user) return;
  
        user.profileImage = this.profileImageUrl;
        await this.store.setUserData(pseudo, user);
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

  async removeProfileImage(): Promise<void> {
    // Simulez la suppression (à remplacer par un appel API réel)
    this.profileImageUrl = '/assets/images/default-avatar.png';
    const current = await this.store.getUserData('currentUser');
    const pseudo = current?.pseudo;
    if (!pseudo) return;

    const user = await this.store.getUserData(pseudo);
    if (!user) return;

    user.profileImage = this.profileImageUrl;
    this.store.setUserData(pseudo, user);
    this.selectedFile = null;
    this.showSuccessMessage('Photo de profil supprimée');
  }

  async updatePseudo(): Promise<void> {
    const newPseudo = this.pseudo.trim();
    if (!newPseudo) return;
  
    try {
      const currentUser = await this.store.getCurrentUser();
      if (!currentUser?.pseudo) return;
  
      const oldPseudo = currentUser.pseudo;
  
      if (oldPseudo === newPseudo) {
        this.showErrorMessage('Le pseudo est déjà utilisé');
        return;
      }
  
      const existingUser = await this.store.getUserData(newPseudo);
      if (existingUser) {
        this.showErrorMessage('Ce pseudo est déjà pris');
        return;
      }
  
      const newUserData = { ...currentUser, pseudo: newPseudo };
  
      await this.store.setUserData(newPseudo, newUserData);

      await this.store.setUserData('currentUser', { pseudo: newPseudo });
  
      await this.store.setUserData(oldPseudo, null);
  
      this.showSuccessMessage('Nom d\'utilisateur mis à jour avec succès');
    } catch (error: any) {
      console.log('Erreur', error);
      this.showErrorMessage('Impossible de modifier le nom d\'utilisateur');
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