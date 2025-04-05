package com.docusafe.model;

public class EncryptionResponse {
    private String message;
    private String originalFilename;
    private String encryptedFileBase64;
    private String aesKey;

    public EncryptionResponse(String message, String originalFilename, String encryptedFileBase64, String aesKey) {
        this.message = message;
        this.originalFilename = originalFilename;
        this.encryptedFileBase64 = encryptedFileBase64;
        this.aesKey = aesKey;
    }

    public String getMessage() {
        return message;
    }

    public String getoriginalFilename() {
        return originalFilename;
    }

    public String getEncryptedFileBase64() {
        return encryptedFileBase64;
    }

    public String getAesKey() {
        return aesKey;
    }
}