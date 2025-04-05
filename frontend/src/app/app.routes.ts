import { Routes } from '@angular/router';
import { WelcomeComponent } from './pages/welcome/welcome.component';
import { UserStartChoicesComponent } from './pages/user-start-choices/user-start-choices.component';
import { HomeComponent } from './pages/home/home.component';
import { DocumentsPageComponent } from './pages/documents-page/documents-page.component';
import { SecurityComponent } from './pages/security/security.component';

export const routes: Routes = [
    { path: '', component: WelcomeComponent },
    { path: 'userStartChoices', component: UserStartChoicesComponent },
    { path: 'home', component: HomeComponent },
    { path: 'documents', component: DocumentsPageComponent },
    { path: 'security', component: SecurityComponent }
];