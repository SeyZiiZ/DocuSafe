package com.docusafe.controller;

import com.docusafe.service.EncryptionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class EncryptionController {

    private final EncryptionService encryptionService;

    @Autowired
    public EncryptionController(EncryptionService encryptionService) {
        this.encryptionService = encryptionService;
    }

    @PostMapping("/encryption")
    public ResponseEntity<?> receiveFile(
        @RequestParam("file") MultipartFile file,
        @RequestParam("encryptionType") String encryptionType,
        @RequestParam(value = "aesKey", required = false) String aesKey,
        @RequestParam(value = "publicKey", required = false) String publicKey
    ) {
        return encryptionService.processFile(file, encryptionType, aesKey, publicKey);
    }
    
}