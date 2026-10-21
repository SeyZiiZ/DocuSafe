// Le backend Spring Boot n'écoute que sur la boucle locale (voir application.properties).
export const API_BASE_URL = 'http://127.0.0.1:8080/api';

export interface EncryptionResponse {
  message: string;
  originalFilename: string;
  encryptedFileBase64: string;
  aesKey?: string;
  publicKey?: string;
  privateKey?: string;
}

export interface DecryptionResponse {
  message: string;
  originalFilename: string;
  encryptionType: 'AES' | 'RSA';
  decryptedFileBase64: string;
}

export interface KeyPairResponse {
  publicKey: string;
  privateKey: string;
}
