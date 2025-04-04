import { Component } from '@angular/core';
import { ElectronStoreService } from '../electron-store.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  currentPath: string = '';

  constructor(
    private store: ElectronStoreService
  ) {}

  async ngOnInit() {
    this.currentPath = await this.store.get('storagePath') || '';
  }
}