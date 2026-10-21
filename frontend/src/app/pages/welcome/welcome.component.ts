import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { ElectronStoreService } from '../../services/electron/electron-store.service';
import { UserProfile } from '../../services/electron/electron-api';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [FormsModule, NgIf, NgFor],
  templateUrl: './welcome.component.html',
})
export class WelcomeComponent implements OnInit {
  pseudo: string = '';
  redirecting: boolean = false;
  countdown: number = 3;
  loading: boolean = true;
  profiles: UserProfile[] = [];
  errorMessage: string = '';
  electronAvailable: boolean = true;

  // Profil protégé en attente du mot de passe
  lockedProfile: UserProfile | null = null;
  password: string = '';
  checkingPassword: boolean = false;

  constructor(
    private router: Router,
    private store: ElectronStoreService
  ) {}

  async ngOnInit() {
    this.electronAvailable = this.store.available;
    const user = await this.store.getCurrentUser();

    if (user?.pseudo && await this.store.isUnlocked(user.pseudo)) {
      this.redirectFor(user);
      return;
    }

    if (user?.pseudo && user.hasPassword) {
      this.lockedProfile = user;
    }
    this.profiles = await this.store.listUsers();
    this.loading = false;
  }

  avatarOf(profile: UserProfile): string {
    return this.store.avatarOf(profile);
  }

  async start() {
    const pseudo = this.pseudo.trim();
    this.errorMessage = this.store.validatePseudo(pseudo) ?? '';
    if (this.errorMessage) return;

    const existingUser = await this.store.getUserData<UserProfile>(pseudo);

    if (existingUser) {
      await this.selectProfile(existingUser);
      return;
    }

    await this.store.setUserData(pseudo, {
      pseudo: pseudo,
      storagePath: null,
      profileImage: '',
      createdAt: new Date().toISOString()
    });
    await this.store.login(pseudo);

    this.redirecting = true;

    const interval = setInterval(() => {
      this.countdown--;

      if (this.countdown === 0) {
        clearInterval(interval);
        this.router.navigateByUrl("/userStartChoices");
      }
    }, 1000);
  }

  async selectProfile(profile: UserProfile) {
    this.errorMessage = '';
    if (profile.hasPassword && !(await this.store.isUnlocked(profile.pseudo))) {
      this.lockedProfile = profile;
      this.password = '';
      return;
    }
    await this.store.login(profile.pseudo);
    this.redirectFor(profile);
  }

  async unlock() {
    if (!this.lockedProfile || !this.password) return;
    this.checkingPassword = true;
    const ok = await this.store.verifyPassword(this.lockedProfile.pseudo, this.password);
    this.checkingPassword = false;

    if (!ok) {
      this.errorMessage = 'Mot de passe incorrect';
      this.password = '';
      return;
    }
    await this.store.login(this.lockedProfile.pseudo);
    this.redirectFor(this.lockedProfile);
  }

  async switchProfile() {
    this.lockedProfile = null;
    this.password = '';
    this.errorMessage = '';
    await this.store.logout();
    this.profiles = await this.store.listUsers();
  }

  private redirectFor(user: UserProfile) {
    this.router.navigateByUrl(user.storagePath ? '/home' : '/userStartChoices');
  }
}
