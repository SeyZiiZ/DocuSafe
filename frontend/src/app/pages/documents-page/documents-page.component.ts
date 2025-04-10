import { Component } from '@angular/core';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { ElectronStoreService } from '../../services/electron/electron-store.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-documents-page',
  standalone: true,
  imports: [SidebarComponent],
  templateUrl: './documents-page.component.html',
})
export class DocumentsPageComponent {
  constructor(
    private store: ElectronStoreService,
    private router: Router
  ) {}

  async disconnect(): Promise<void> {
    this.store.setUserData('currentUser', null);
    this.router.navigateByUrl('/');
  }
}
