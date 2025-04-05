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
    this.currentPath = await this.store.get('storagePath') || '';
    this.pseudo = await this.store.get('pseudo') || 'Unknown ?';
    this.profileImageUrl = await this.store.get('profileImage') || '';

    if (this.currentPath) {
      this.fileService.files$.subscribe(files => this.files = files);
      await this.fileService.loadFiles(this.currentPath);
    }
  }

  disconnect() {
    this.store.set("pseudo", "");
    this.router.navigateByUrl("/");
  }
}