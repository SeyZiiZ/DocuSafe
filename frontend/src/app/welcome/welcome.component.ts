import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { ElectronStoreService } from '../electron-store.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [FormsModule, NgIf],
  templateUrl: './welcome.component.html',
})
export class WelcomeComponent {
  pseudo: string = '';
  redirecting: boolean = false;
  countdown: number = 3;

  constructor(
    private router: Router,
    private store: ElectronStoreService
  ) {}

  start() {
    if (this.pseudo.trim()) {
      this.store.set('pseudo', this.pseudo);
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
}