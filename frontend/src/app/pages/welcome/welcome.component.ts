import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { ElectronStoreService } from '../../services/electron/electron-store.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [FormsModule, NgIf],
  templateUrl: './welcome.component.html',
})
export class WelcomeComponent implements OnInit {
  pseudo: string = '';
  redirecting: boolean = false;
  countdown: number = 3;
  loading: boolean = true;

  constructor(
    private router: Router,
    private store: ElectronStoreService
  ) {}

  async ngOnInit() {
    const user = await this.store.getCurrentUser();

    if (user?.pseudo && user?.storagePath) {
      this.router.navigateByUrl('/home');
    } else if (user?.pseudo && !user?.storagePath) {
      this.router.navigateByUrl('/userStartChoices')
    } else {
      this.loading = false;
    }
  }

  async start() {
    const pseudo = this.pseudo.trim();
    if (!pseudo) return;

    const existingUser = await this.store.getUserData(pseudo);

    if (!existingUser) {
        this.store.setUserData(pseudo, {
        pseudo: pseudo,
        storagePath: null,
        profileImage: '/assets/images/default-avatar.png',
        createdAt: new Date().toISOString()
      });
    }
    await this.store.setUserData('currentUser', { pseudo });

    this.redirecting = true;

    const interval = setInterval(() => {
      this.countdown--;
  
      if (this.countdown === 0) {
        clearInterval(interval);
        this.router.navigateByUrl("/userStartChoices");
      }
    }, 1000);
  }
}