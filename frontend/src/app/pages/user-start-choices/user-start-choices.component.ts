import { Component } from '@angular/core';
import { ElectronStoreService } from '../../services/electron/electron-store.service';
import { ElectronFileService } from '../../services/electron/electron-file.service';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-start-choices',
  standalone: true,
  imports: [FormsModule, NgIf],
  templateUrl: './user-start-choices.component.html',
})
export class UserStartChoicesComponent {
  selectedPath: string = '';
  pseudo: string = '';
  encryptionEnabled: boolean = true;
  errorMessage: string = '';

  constructor(
    private router: Router,
    private store: ElectronStoreService,
    private fileService: ElectronFileService
  ) {}

  async ngOnInit() {
    const user = await this.store.getCurrentUser();
    if (!user?.pseudo || !(await this.store.isUnlocked(user.pseudo))) {
      this.router.navigateByUrl('/');
      return;
    }

    if (user?.storagePath) {
      this.router.navigateByUrl('/home');
    } else {
      this.pseudo = user?.pseudo;
    }
  }

  async chooseDirectory() {
    const path = await this.fileService.chooseDirectory();
    if (!path) return;

    const user = await this.store.getCurrentUser();
    if (!user?.pseudo) return;

    user.storagePath = path;
    this.selectedPath = path;

    await this.store.setUserData(user.pseudo, user);
  }

  async continue() {
    if (!this.selectedPath || !this.pseudo) return;

    if (this.encryptionEnabled) {
      const result = await this.store.createProfileKey(this.pseudo);
      if (!result.success) {
        this.errorMessage = result.error ?? 'Impossible de créer la clé de profil';
        return;
      }
    }
    this.router.navigateByUrl("/home");
  }
}
