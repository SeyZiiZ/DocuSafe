import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ElectronStoreService {
  private isBrowser: boolean = typeof window !== 'undefined';

  async getUserData<T = any>(userId: string): Promise<T | undefined> {
    if (this.isBrowser && (window as any).electronStore?.getUserData) {
      return await (window as any).electronStore.getUserData(userId);
    }
    return undefined;
  }

  setUserData<T = any>(userId: string, userData: T): void {
    if (this.isBrowser && (window as any).electronStore?.setUserData) {
      (window as any).electronStore.setUserData(userId, userData);
    }
  }

  async getCurrentUser(): Promise<any | undefined> {
    const current = await this.getUserData('currentUser');
    if (!current?.pseudo) return undefined;
  
    return await this.getUserData(current.pseudo);
  }
}