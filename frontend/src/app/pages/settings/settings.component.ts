import { Component } from '@angular/core';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ElectronStoreService } from '../../services/electron/electron-store.service';
import { ElectronFileService } from '../../services/electron/electron-file.service';
import { UserProfile } from '../../services/electron/electron-api';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  pseudo: string = '';
  originalPseudo: string = '';
  profileImageUrl: string | null = null;
  selectedFile: File | null = null;
  storagePath: string = '';
  successMessage: string = '';
  errorMessage: string = '';

  hasPassword: boolean = false;
  currentPassword: string = '';
  newPassword: string = '';
  confirmPassword: string = '';

  hasProfileKey: boolean = false;
  profileKey: string | null = null;
  showProfileKey: boolean = false;
  profileKeyPassword: string = '';

  confirmDelete: boolean = false;
  deleteConfirmText: string = '';

  constructor(
    private store: ElectronStoreService,
    private fileService: ElectronFileService,
    private router: Router
  ) {}

  async ngOnInit() {
    const user = await this.store.getCurrentUser();
    if (!user) return;
    this.applyUser(user);
  }

  private applyUser(user: UserProfile): void {
    this.pseudo = user.pseudo;
    this.originalPseudo = user.pseudo;
    this.profileImageUrl = this.store.avatarOf(user);
    this.storagePath = user.storagePath ?? '';
    this.hasPassword = !!user.hasPassword;
    this.hasProfileKey = !!user.hasProfileKey;
  }

  private async reloadUser(): Promise<void> {
    const user = await this.store.getCurrentUser();
    if (user) this.applyUser(user);
  }

  async disconnect(): Promise<void> {
    await this.store.logout();
    this.router.navigateByUrl('/');
  }

  // Photo de profil ---------------------------------------------------------

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      input.value = '';
      if (file.size > MAX_AVATAR_SIZE) {
        this.showErrorMessage('Image trop volumineuse (2 Mo maximum)');
        return;
      }
      this.selectedFile = file;

      const reader = new FileReader();
      reader.onload = (e) => this.profileImageUrl = e.target?.result as string;
      reader.readAsDataURL(file);
    }
  }

  async uploadProfileImage(): Promise<void> {
    if (!this.selectedFile || !this.profileImageUrl) return;
    await this.updateProfile({ profileImage: this.profileImageUrl });
    this.selectedFile = null;
    this.showSuccessMessage('Photo de profil mise à jour avec succès');
  }

  async removeProfileImage(): Promise<void> {
    await this.updateProfile({ profileImage: '' });
    this.selectedFile = null;
    this.profileImageUrl = this.store.avatarOf(null);
    this.showSuccessMessage('Photo de profil supprimée');
  }

  private async updateProfile(changes: Partial<UserProfile>): Promise<void> {
    const user = await this.store.getCurrentUser();
    if (!user) return;
    await this.store.setUserData(user.pseudo, { ...user, ...changes });
  }

  // Pseudo ------------------------------------------------------------------

  async updatePseudo(): Promise<void> {
    const newPseudo = this.pseudo.trim();
    const invalid = this.store.validatePseudo(newPseudo);
    if (invalid) {
      this.showErrorMessage(invalid);
      return;
    }
    if (newPseudo === this.originalPseudo) {
      this.showErrorMessage('C\'est déjà votre pseudo');
      return;
    }

    try {
      const result = await this.store.renameUser(this.originalPseudo, newPseudo);
      if (!result.success) {
        this.showErrorMessage(result.error ?? 'Impossible de modifier le nom d\'utilisateur');
        return;
      }
      await this.reloadUser();
      this.showSuccessMessage('Nom d\'utilisateur mis à jour avec succès');
    } catch (error: any) {
      console.log('Erreur', error);
      this.showErrorMessage('Impossible de modifier le nom d\'utilisateur');
    }
  }

  // Dossier de stockage -----------------------------------------------------

  async changeStorageFolder(): Promise<void> {
    const path = await this.fileService.chooseDirectory();
    if (!path) return;
    await this.updateProfile({ storagePath: path });
    this.storagePath = path;
    this.showSuccessMessage('Dossier de stockage modifié');
  }

  // Mot de passe ------------------------------------------------------------

  async savePassword(): Promise<void> {
    if (this.newPassword.length < 8) {
      this.showErrorMessage('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.showErrorMessage('Les deux mots de passe ne correspondent pas');
      return;
    }

    const result = await this.store.setPassword(this.originalPseudo, this.hasPassword ? this.currentPassword : null, this.newPassword);
    if (!result.success) {
      this.showErrorMessage(result.error ?? 'Impossible de modifier le mot de passe');
      return;
    }
    const message = this.hasPassword ? 'Mot de passe modifié' : 'Mot de passe défini : il sera demandé à chaque ouverture';
    this.clearPasswordFields();
    await this.reloadUser();
    this.showSuccessMessage(message);
  }

  async removePassword(): Promise<void> {
    const result = await this.store.setPassword(this.originalPseudo, this.currentPassword, null);
    if (!result.success) {
      this.showErrorMessage(result.error ?? 'Impossible de supprimer le mot de passe');
      return;
    }
    this.clearPasswordFields();
    await this.reloadUser();
    this.showSuccessMessage('Mot de passe supprimé');
  }

  private clearPasswordFields(): void {
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
  }

  // Clé de profil -----------------------------------------------------------

  async createProfileKey(): Promise<void> {
    const result = await this.store.createProfileKey(this.originalPseudo, this.profileKeyPassword || undefined);
    this.profileKeyPassword = '';
    if (!result.success) {
      this.showErrorMessage(result.error ?? 'Impossible de créer la clé de profil');
      return;
    }
    await this.reloadUser();
    this.showSuccessMessage('Clé de profil créée');
  }

  async toggleProfileKey(): Promise<void> {
    this.showProfileKey = !this.showProfileKey;
    this.profileKey = this.showProfileKey ? await this.store.getProfileKey(this.originalPseudo) : null;
  }

  async copyProfileKey(): Promise<void> {
    const key = await this.store.getProfileKey(this.originalPseudo);
    if (!key) return;
    await navigator.clipboard.writeText(key);
    this.showSuccessMessage('Clé copiée dans le presse-papiers');
  }

  // Suppression du profil ---------------------------------------------------

  async deleteProfile(): Promise<void> {
    if (this.deleteConfirmText !== this.originalPseudo) return;
    await this.store.logout();
    await this.store.deleteUser(this.originalPseudo);
    this.router.navigateByUrl('/');
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
