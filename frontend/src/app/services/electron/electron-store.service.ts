import { Injectable } from '@angular/core';
import { OperationResult, UserProfile } from './electron-api';

export const DEFAULT_AVATAR = '/assets/images/default-avatar.svg';
const RESERVED_PSEUDOS = ['currentUser', '__proto__', 'constructor', 'prototype'];

@Injectable({ providedIn: 'root' })
export class ElectronStoreService {
  private isBrowser: boolean = typeof window !== 'undefined';

  /** Faux quand l'interface est ouverte dans un navigateur au lieu d'Electron. */
  get available(): boolean {
    return this.isBrowser && !!window.electronStore;
  }

  async getUserData<T = any>(userId: string): Promise<T | undefined> {
    if (this.isBrowser && window.electronStore?.getUserData) {
      return await window.electronStore.getUserData(userId);
    }
    return undefined;
  }

  async setUserData<T = any>(userId: string, userData: T): Promise<void> {
    if (this.isBrowser && window.electronStore?.setUserData) {
      await window.electronStore.setUserData(userId, userData);
    }
  }

  async getCurrentUser(): Promise<UserProfile | undefined> {
    const current = await this.getUserData('currentUser');
    if (!current?.pseudo) return undefined;

    return await this.getUserData<UserProfile>(current.pseudo);
  }

  async listUsers(): Promise<UserProfile[]> {
    return (await window.electronStore?.listUsers()) ?? [];
  }

  async renameUser(oldPseudo: string, newPseudo: string): Promise<OperationResult> {
    return (await window.electronStore?.renameUser(oldPseudo, newPseudo)) ?? { success: false, error: 'Electron indisponible' };
  }

  async deleteUser(pseudo: string): Promise<void> {
    await window.electronStore?.deleteUser(pseudo);
  }

  async isUnlocked(pseudo: string): Promise<boolean> {
    return (await window.electronStore?.isUnlocked(pseudo)) ?? false;
  }

  async verifyPassword(pseudo: string, password: string): Promise<boolean> {
    return (await window.electronStore?.verifyPassword(pseudo, password)) ?? false;
  }

  async setPassword(pseudo: string, currentPassword: string | null, newPassword: string | null): Promise<OperationResult> {
    return (await window.electronStore?.setPassword(pseudo, currentPassword, newPassword)) ?? { success: false, error: 'Electron indisponible' };
  }

  async getProfileKey(pseudo: string): Promise<string | null> {
    return (await window.electronStore?.getProfileKey(pseudo)) ?? null;
  }

  async createProfileKey(pseudo: string, password?: string): Promise<OperationResult> {
    return (await window.electronStore?.createProfileKey(pseudo, password)) ?? { success: false, error: 'Electron indisponible' };
  }

  async login(pseudo: string): Promise<void> {
    await this.setUserData('currentUser', { pseudo });
  }

  async logout(): Promise<void> {
    const current = await this.getUserData('currentUser');
    if (current?.pseudo) await window.electronStore?.lock(current.pseudo);
    await window.electronAPI?.watchFolder(null);
    await this.setUserData('currentUser', null);
  }

  validatePseudo(pseudo: string): string | null {
    if (!pseudo) return 'Entrez un pseudo';
    if (pseudo.length > 40) return 'Le pseudo ne doit pas dépasser 40 caractères';
    if (RESERVED_PSEUDOS.includes(pseudo)) return 'Ce pseudo est réservé';
    return null;
  }

  /** Photo personnalisée (data URL) ou avatar par défaut, y compris pour les anciens profils. */
  avatarOf(user: UserProfile | undefined | null): string {
    return user?.profileImage?.startsWith('data:') ? user.profileImage : DEFAULT_AVATAR;
  }
}
