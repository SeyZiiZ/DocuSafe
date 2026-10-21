package com.docusafe.service;

import com.docusafe.crypto.FileCipher;
import com.docusafe.crypto.PemKeys;
import com.docusafe.exception.CryptoException;
import com.docusafe.model.EncryptionResponse;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.KeyPair;
import java.util.Base64;

@Service
public class EncryptionService {

    private final FileCipher cipher;

    public EncryptionService(FileCipher cipher) {
        this.cipher = cipher;
    }

    public EncryptionResponse processFile(MultipartFile file, String encryptionType, String aesKey, String publicKey) throws IOException {
        String filename = file.getOriginalFilename();
        byte[] fileBytes = file.getBytes();

        if (encryptionType.equalsIgnoreCase("AES")) {
            return encryptWithAes(fileBytes, filename, aesKey);
        }
        if (encryptionType.equalsIgnoreCase("RSA")) {
            return encryptWithRsa(fileBytes, filename, publicKey);
        }
        throw new CryptoException("Type de chiffrement non supporté : " + encryptionType);
    }

    private EncryptionResponse encryptWithAes(byte[] fileBytes, String filename, String aesKey) {
        if (aesKey == null || aesKey.isBlank()) {
            byte[] generatedKey = cipher.generateAesKey();
            byte[] encrypted = cipher.encryptWithKey(fileBytes, generatedKey, filename);
            return response("✅ Fichier chiffré avec AES-256-GCM (clé générée)", filename, encrypted,
                Base64.getEncoder().encodeToString(generatedKey), null, null);
        }

        if (FileCipher.isRawAesKey(aesKey)) {
            byte[] encrypted = cipher.encryptWithKey(fileBytes, Base64.getDecoder().decode(aesKey.trim()), filename);
            return response("✅ Fichier chiffré avec AES-256-GCM (votre clé)", filename, encrypted, null, null, null);
        }

        byte[] encrypted = cipher.encryptWithPassword(fileBytes, aesKey, filename);
        return response("✅ Fichier chiffré avec AES-256-GCM (mot de passe)", filename, encrypted, null, null, null);
    }

    private EncryptionResponse encryptWithRsa(byte[] fileBytes, String filename, String publicKey) {
        if (publicKey == null || publicKey.isBlank()) {
            KeyPair pair = PemKeys.generateRsaKeyPair();
            byte[] encrypted = cipher.encryptWithPublicKey(fileBytes, pair.getPublic(), filename);
            return response("✅ Fichier chiffré avec RSA-OAEP + AES-256-GCM (paire de clés générée)", filename, encrypted,
                null, PemKeys.toPem(pair.getPublic()), PemKeys.toPem(pair.getPrivate()));
        }

        byte[] encrypted = cipher.encryptWithPublicKey(fileBytes, PemKeys.parsePublicKey(publicKey), filename);
        return response("✅ Fichier chiffré avec RSA-OAEP + AES-256-GCM (votre clé publique)", filename, encrypted, null, null, null);
    }

    private EncryptionResponse response(String message, String filename, byte[] encrypted, String aesKey, String publicKey, String privateKey) {
        return new EncryptionResponse(message, filename, Base64.getEncoder().encodeToString(encrypted), aesKey, publicKey, privateKey);
    }
}
