import { Routes } from '@angular/router';
import { WelcomeComponent } from './pages/welcome/welcome.component';
import { UserStartChoicesComponent } from './pages/user-start-choices/user-start-choices.component';
import { HomeComponent } from './pages/home/home.component';
import { DocumentsPageComponent } from './pages/documents-page/documents-page.component';
import { SecurityComponent } from './pages/security/security.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { EditorComponent } from './pages/editor/editor.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    { path: '', component: WelcomeComponent },
    { path: 'userStartChoices', component: UserStartChoicesComponent },
    { path: 'home', component: HomeComponent, canActivate: [authGuard] },
    { path: 'documents', component: DocumentsPageComponent, canActivate: [authGuard] },
    {
        path: 'editor',
        component: EditorComponent,
        canActivate: [authGuard],
        canDeactivate: [(editor: EditorComponent) => editor.canLeave()]
    },
    { path: 'security', component: SecurityComponent, canActivate: [authGuard] },
    { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
    { path: '**', redirectTo: '' }
];
