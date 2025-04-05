package com.docusafe.controller;

import com.docusafe.service.DecryptionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class DecryptionController {

    private final DecryptionService decryptionService;

    @Autowired
    public DecryptionController(DecryptionService decryptionService) {
        this.decryptionService = decryptionService;
    }

    @PostMapping("/decryption")
    public ResponseEntity<?> receiveFile(
        @RequestParam("file") MultipartFile file,
        @RequestParam("encryptionType") String encryptionType,
        @RequestParam(value = "aesKey", required = false) String aesKey,
        @RequestParam(value = "publicKey", required = false) String publicKey
    ) {
        return decryptionService.processFile(file, encryptionType, aesKey, publicKey);
    }
}