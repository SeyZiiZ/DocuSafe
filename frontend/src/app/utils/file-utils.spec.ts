import { HttpErrorResponse } from '@angular/common/http';
import {
  apiErrorMessage, base64ToBytes, basename, bytesToBase64, detectEncryptionMode, dirname, extensionOf, formatBytes,
  isEditableFile, isEncryptedFile, isSubPath, joinPath, relativeSegments, stripExtension, textToBase64
} from './file-utils';

describe('file-utils', () => {
  describe('detectEncryptionMode', () => {
    const header = (mode: number) => new Uint8Array([0x44, 0x53, 0x46, 0x31, mode, 0, 0, 0]);

    it('lit le mode dans l\'en-tête DocuSafe', () => {
      expect(detectEncryptionMode(header(1))).toBe('AES_KEY');
      expect(detectEncryptionMode(header(2))).toBe('AES_PASSWORD');
      expect(detectEncryptionMode(header(3))).toBe('RSA');
    });

    it('considère un fichier sans en-tête comme l\'ancien format', () => {
      expect(detectEncryptionMode(new Uint8Array([1, 2, 3, 4, 5]))).toBe('LEGACY');
      expect(detectEncryptionMode(new Uint8Array([]))).toBe('LEGACY');
    });
  });

  describe('base64', () => {
    it('fait l\'aller-retour sur des octets binaires', () => {
      const bytes = new Uint8Array(70000).map((_, i) => i % 256);
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    });

    it('encode le texte en UTF-8', () => {
      expect(new TextDecoder().decode(base64ToBytes(textToBase64('Clé privée ✓')))).toBe('Clé privée ✓');
    });
  });

  describe('chemins', () => {
    it('gère les séparateurs Windows et POSIX', () => {
      expect(basename('C:\\Docs\\contrat.pdf')).toBe('contrat.pdf');
      expect(basename('/home/me/notes.md')).toBe('notes.md');
      expect(dirname('C:\\Docs\\Sous\\a.txt')).toBe('C:\\Docs\\Sous');
      expect(joinPath('C:\\Docs\\', 'a.txt')).toBe('C:\\Docs\\a.txt');
      expect(joinPath('/home/me', 'a.txt')).toBe('/home/me/a.txt');
    });

    it('détecte si un chemin est dans le dossier racine', () => {
      expect(isSubPath('C:\\Docs', 'C:\\Docs')).toBeTrue();
      expect(isSubPath('C:\\Docs', 'c:\\docs\\Sous')).toBeTrue();
      expect(isSubPath('C:\\Docs', 'C:\\Docs2')).toBeFalse();
      expect(isSubPath('C:\\Docs', 'C:\\Autre')).toBeFalse();
    });

    it('découpe le chemin relatif pour le fil d\'Ariane', () => {
      expect(relativeSegments('C:\\Docs', 'C:\\Docs')).toEqual([]);
      expect(relativeSegments('C:\\Docs', 'C:\\Docs\\Factures\\2026')).toEqual(['Factures', '2026']);
      expect(relativeSegments('C:\\Docs', 'D:\\Ailleurs')).toEqual([]);
    });
  });

  describe('types de fichiers', () => {
    it('reconnaît les extensions', () => {
      expect(extensionOf('Rapport.HTML')).toBe('.html');
      expect(extensionOf('.gitignore')).toBe('');
      expect(stripExtension('notes.md')).toBe('notes');
      expect(isEncryptedFile('a.pdf.encrypted')).toBeTrue();
      expect(isEncryptedFile('a.pdf')).toBeFalse();
      expect(isEditableFile('a.md')).toBeTrue();
      expect(isEditableFile('a.pdf')).toBeFalse();
    });

    it('formate les tailles', () => {
      expect(formatBytes(512)).toBe('512 o');
      expect(formatBytes(2048)).toBe('2.0 Ko');
      expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 Mo');
    });
  });

  describe('apiErrorMessage', () => {
    it('signale un backend injoignable', () => {
      expect(apiErrorMessage(new HttpErrorResponse({ status: 0 }))).toContain('injoignable');
    });

    it('reprend le message renvoyé par le backend', () => {
      const err = new HttpErrorResponse({ status: 400, error: { message: 'Clé incorrecte ou fichier altéré' } });
      expect(apiErrorMessage(err)).toBe('Clé incorrecte ou fichier altéré');
    });
  });
});
