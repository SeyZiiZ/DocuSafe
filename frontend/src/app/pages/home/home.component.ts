import { Component } from '@angular/core';
import { ElectronStoreService } from '../../electron-store.service';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { FeatureCardComponent } from '../../components/feature-card/feature-card.component';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { FilesContainerComponent } from '../../components/files-container/files-container.component';
import icons from '../../components/icons/icons';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, FeatureCardComponent, SidebarComponent, FilesContainerComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  currentPath: string = '';
  pseudo: string = '';
  icons = icons;

  constructor(
    private store: ElectronStoreService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.currentPath = await this.store.get('storagePath') || '';
    this.pseudo = await this.store.get('pseudo') || 'Unknown ?';
  }

  disconnect() {
    this.store.set("pseudo", "");
    this.router.navigateByUrl("/");
  }

  recentFiles = [
    {
      name: 'Rapport Financier',
      size: '458 Ko',
      modified: 'Il y a 2 heures',
      iconColor: 'text-blue-500',
      iconSVG: `<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>`
    },
    {
      name: 'Présentation Client',
      size: '2.3 Mo',
      modified: 'Hier',
      iconColor: 'text-green-500',
      iconSVG: `<path fill-rule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
          clip-rule="evenodd"></path>`
    },
    {
      name: 'Contrat_2025.pdf',
      size: '1.2 Mo',
      modified: 'Il y a 3 jours',
      iconColor: 'text-red-500',
      iconSVG: `<path fill-rule="evenodd"
        d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z"
        clip-rule="evenodd"></path>`
    },
  ]
}