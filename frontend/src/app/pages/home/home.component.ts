import { Component } from '@angular/core';
import { ElectronStoreService } from '../../services/electron/electron-store.service';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FeatureCardComponent } from '../../components/feature-card/feature-card.component';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { FilesContainerComponent } from '../../components/files-container/files-container.component';
import { ElectronFileService, FileEntry } from '../../services/electron/electron-file.service';
import icons from '../../components/icons/icons';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CommonModule, FeatureCardComponent, SidebarComponent, FilesContainerComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  currentPath: string = '';
  pseudo: string = '';
  profileImageUrl: string = '';
  files: FileEntry[] = [];
  icons = icons;

  constructor(
    private store: ElectronStoreService,
    private fileService: ElectronFileService,
    private router: Router
  ) {}

  async ngOnInit() {
    const user = await this.store.getCurrentUser();
    if (!user) return;

    this.currentPath = user?.storagePath || '?'
    this.pseudo = user?.pseudo || 'Unknown ?';
    this.profileImageUrl = user?.profileImage || '/assets/images/default-avatar.png';

    if (this.currentPath) {
      this.fileService.files$.subscribe(files => this.files = files);
      await this.fileService.loadFiles(this.currentPath);
    }
  }

  async disconnect(): Promise<void> {
    this.store.setUserData('currentUser', null);
    this.router.navigateByUrl('/');
  }
}