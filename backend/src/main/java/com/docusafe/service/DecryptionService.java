// TO DO : COMPLETLY CHANGE LOGIC (ENCRYPTION LOGIC FOR THE MOMENT)
package com.docusafe.service;
import com.docusafe.model.EncryptionResponse;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import java.security.NoSuchAlgorithmException;
import java.util.Base64;

@Service
public class DecryptionService {
    public ResponseEntity<?> processFile(MultipartFile file, String encryptionType, String aesKey, String publicKey) {
        try {
            String filename = file.getOriginalFilename();
            byte[] fileBytes = file.getBytes();

            if (encryptionType.equalsIgnoreCase("AES")) {
                if (aesKey == null || aesKey.isEmpty()) {
                    aesKey = generateRandomAESKey();
                    if (aesKey == null) return ResponseEntity.status(500).body("Erreur génération clé AES");
                }
            
                byte[] encrypted = encryptWithAES(fileBytes, aesKey);
                if (encrypted == null) return ResponseEntity.status(500).body("Erreur lors du chiffrement AES");
            
                String base64Encrypted = Base64.getEncoder().encodeToString(encrypted);
                EncryptionResponse response = new EncryptionResponse(
                    "✅ Fichier chiffré avec AES",
                    filename,
                    base64Encrypted,
                    aesKey
                );
                return ResponseEntity.ok(response);
            }

            return ResponseEntity.badRequest().body("Type de chiffrement non supporté : " + encryptionType);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Erreur : " + e.getMessage());
        }
    }

    private String generateRandomAESKey() {
        try {
            KeyGenerator keyGen = KeyGenerator.getInstance("AES");
            keyGen.init(256); // 128 || 192 || 256
            SecretKey secretKey = keyGen.generateKey();
            return Base64.getEncoder().encodeToString(secretKey.getEncoded());
        } catch (NoSuchAlgorithmException e) {
            System.err.println("❌ Erreur lors de la génération de la clé AES : " + e.getMessage());
            return null;
        }
    }
    
    private byte[] encryptWithAES(byte[] data, String base64Key) {
        try {
            byte[] keyBytes = Base64.getDecoder().decode(base64Key);
            SecretKeySpec secretKey = new SecretKeySpec(keyBytes, "AES");
    
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, secretKey);
    
            return cipher.doFinal(data);
        } catch (Exception e) {
            System.err.println("❌ Erreur lors du chiffrement AES : " + e.getMessage());
            return null;
        }
    }
}
