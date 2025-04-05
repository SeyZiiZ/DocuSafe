import { Component } from '@angular/core';
import { ElectronStoreService } from '../../electron-store.service';
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
    this.pseudo = await this.store.get('pseudo') || '';
    this.store.set('encryption', this.encryptionEnabled);
  }

  chooseDirectory() {
    (window as any).electronAPI.chooseDirectory().then((path: string) => {
      if (path) {
        this.selectedPath = path;
        this.store.set('storagePath', path);
      }
    });
  }

  continue() {
    if (this.selectedPath && this.pseudo) {
      this.router.navigateByUrl("/home");
    }
  }
}