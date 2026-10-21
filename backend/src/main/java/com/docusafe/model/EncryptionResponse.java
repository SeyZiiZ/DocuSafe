package com.docusafe.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * aesKey : clé générée pour le fichier (absente si l'utilisateur a fourni sa clé ou son mot de passe).
 * publicKey / privateKey : paire RSA générée quand aucune clé publique n'a été fournie.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record EncryptionResponse(
    String message,
    String originalFilename,
    String encryptedFileBase64,
    String aesKey,
    String publicKey,
    String privateKey
) {}
