package com.docusafe.service;

import com.docusafe.crypto.FileCipher;
import com.docusafe.crypto.PemKeys;
import com.docusafe.model.DecryptionResponse;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.PrivateKey;
import java.util.Base64;

@Service
public class DecryptionService {

    private final FileCipher cipher;

    public DecryptionService(FileCipher cipher) {
        this.cipher = cipher;
    }

    public DecryptionResponse processFile(MultipartFile file, String aesKey, String privateKey) throws IOException {
        byte[] fileBytes = file.getBytes();

        if (!FileCipher.hasDocuSafeHeader(fileBytes)) {
            return new DecryptionResponse(
                "✅ Fichier déchiffré (AES, ancien format)",
                legacyFilename(file.getOriginalFilename()),
                "AES",
                Base64.getEncoder().encodeToString(cipher.decryptLegacy(fileBytes, aesKey))
            );
        }

        // Le mode est lu dans l'en-tête du fichier : seule la clé correspondante est analysée.
        PrivateKey rsaKey = cipher.readMode(fileBytes) == FileCipher.Mode.RSA
            ? PemKeys.parsePrivateKey(privateKey)
            : null;

        FileCipher.DecryptedFile decrypted = cipher.decrypt(fileBytes, aesKey, rsaKey);
        String type = decrypted.mode() == FileCipher.Mode.RSA ? "RSA" : "AES";

        return new DecryptionResponse(
            "✅ Fichier déchiffré (" + type + ")",
            decrypted.originalFilename(),
            type,
            Base64.getEncoder().encodeToString(decrypted.data())
        );
    }

    private String legacyFilename(String uploadedName) {
        String name = uploadedName == null ? "document" : uploadedName;
        name = name.substring(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
        return name.endsWith(".encrypted") ? name.substring(0, name.length() - ".encrypted".length()) : name;
    }
}
