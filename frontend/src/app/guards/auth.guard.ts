import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ElectronStoreService } from '../services/electron/electron-store.service';

/** Pages réservées à un profil connecté, déverrouillé et disposant d'un dossier de stockage. */
export const authGuard: CanActivateFn = async () => {
  const store = inject(ElectronStoreService);
  const router = inject(Router);

  const user = await store.getCurrentUser();
  if (!user?.pseudo || !(await store.isUnlocked(user.pseudo))) {
    return router.parseUrl('/');
  }
  if (!user.storagePath) {
    return router.parseUrl('/userStartChoices');
  }
  return true;
};
