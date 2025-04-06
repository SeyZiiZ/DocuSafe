import { Component } from '@angular/core';
import { ElectronStoreService } from '../../services/electron/electron-store.service';
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
  encryptionEnabled: boolean = false;

  constructor(
    private router: Router,
    private store: ElectronStoreService
  ) {}

  async ngOnInit() {
    const user = await this.store.getCurrentUser();
    if (!user?.pseudo) {
      this.router.navigateByUrl('/');
      return;
    }

    if (user?.storagePath) {
      this.router.navigateByUrl('/home');
    } else {
      this.pseudo = user?.pseudo;
    }
  }

  chooseDirectory() {
    (window as any).electronAPI.chooseDirectory().then(async (path: string) => {
      if (path) {
        const user = await this.store.getCurrentUser();
        if (!user && !user?.pseudo) return;
  
        user.storagePath = path;
        this.selectedPath = path;

        this.store.setUserData(user.pseudo, user);
      }
    });
  }

  continue() {
    if (this.selectedPath && this.pseudo) {
      this.router.navigateByUrl("/home");
    }
  }
}