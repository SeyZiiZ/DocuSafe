import { Routes } from '@angular/router';
import { WelcomeComponent } from './welcome/welcome.component';
import { UserStartChoicesComponent } from './user-start-choices/user-start-choices.component';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
    { path: '', component: WelcomeComponent },
    { path: 'userStartChoices', component: UserStartChoicesComponent },
    { path: 'home', component: HomeComponent }
];