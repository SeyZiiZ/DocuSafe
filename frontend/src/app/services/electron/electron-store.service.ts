import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ElectronStoreService {
  private isBrowser: boolean = typeof window !== 'undefined';

  set<T = any>(key: string, value: T): void {
    if (this.isBrowser && (window as any).electronStore?.set) {
      (window as any).electronStore.set(key, value);
    }
  }

  async get<T = any>(key: string): Promise<T | undefined> {
    if (this.isBrowser && (window as any).electronStore?.get) {
      return await (window as any).electronStore.get(key);
    }
    return undefined;
  }
}