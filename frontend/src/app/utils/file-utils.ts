import { HttpErrorResponse } from '@angular/common/http';

export type EncryptionMode = 'AES_KEY' | 'AES_PASSWORD' | 'RSA' | 'LEGACY';

const MAGIC = [0x44, 0x53, 0x46, 0x31]; // "DSF1"
const EDITABLE_EXTENSIONS = ['.html', '.htm', '.txt', '.md'];

/** Lit le mode dans l'en-tête d'un fichier .encrypted (voir FileCipher côté backend). */
export function detectEncryptionMode(header: Uint8Array): EncryptionMode {
  const hasMagic = header.length > MAGIC.length && MAGIC.every((byte, i) => header[i] === byte);
  if (!hasMagic) return 'LEGACY';
  switch (header[4]) {
    case 1: return 'AES_KEY';
    case 2: return 'AES_PASSWORD';
    case 3: return 'RSA';
    default: return 'LEGACY';
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function base64ToBlob(base64: string, type = 'application/octet-stream'): Blob {
  return new Blob([base64ToBytes(base64)], { type });
}

export function textToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

export function basename(filePath: string): string {
  return filePath.substring(Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')) + 1);
}

export function dirname(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return index > 0 ? filePath.substring(0, index) : filePath;
}

export function joinPath(folder: string, name: string): string {
  const separator = folder.includes('\\') ? '\\' : '/';
  return folder.replace(/[\\/]+$/, '') + separator + name;
}

/** Vrai si target est root ou se trouve dedans (insensible à la casse, comme Windows). */
export function isSubPath(root: string, target: string): boolean {
  const normalize = (p: string) => p.replace(/[\\/]+$/, '').toLowerCase();
  const r = normalize(root);
  const t = normalize(target);
  return t === r || t.startsWith(r + '\\') || t.startsWith(r + '/');
}

/** Dossiers traversés entre la racine et le dossier courant (vide si on est à la racine). */
export function relativeSegments(root: string, folder: string): string[] {
  if (!isSubPath(root, folder)) return [];
  return folder.substring(root.replace(/[\\/]+$/, '').length).split(/[\\/]/).filter(Boolean);
}

export function extensionOf(name: string): string {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.substring(index).toLowerCase() : '';
}

export function stripExtension(name: string): string {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.substring(0, index) : name;
}

export function isEncryptedFile(name: string): boolean {
  return name.toLowerCase().endsWith('.encrypted');
}

export function isEditableFile(name: string): boolean {
  return EDITABLE_EXTENSIONS.includes(extensionOf(name));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' Mo';
  return (bytes / 1024 ** 3).toFixed(1) + ' Go';
}

export function apiErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'Le service de chiffrement est injoignable : lancez le backend (cd backend && mvn spring-boot:run).';
    }
    return err.error?.message ?? `Erreur du serveur (${err.status})`;
  }
  return err instanceof Error ? err.message : 'Erreur inattendue';
}
