package com.docusafe.model;

public record DecryptionResponse(
    String message,
    String originalFilename,
    String encryptionType,
    String decryptedFileBase64
) {}
