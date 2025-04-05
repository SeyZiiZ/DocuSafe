package com.docusafe.controller;

import com.docusafe.service.ChiffrementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class ChiffrementController {

    private final ChiffrementService chiffrementService;

    @Autowired
    public ChiffrementController(ChiffrementService chiffrementService) {
        this.chiffrementService = chiffrementService;
    }

    @PostMapping("/chiffrement")
    public ResponseEntity<?> receiveFile(
        @RequestParam("file") MultipartFile file,
        @RequestParam("encryptionType") String encryptionType,
        @RequestParam(value = "aesKey", required = false) String aesKey,
        @RequestParam(value = "publicKey", required = false) String publicKey
    ) {
        return chiffrementService.processFile(file, encryptionType, aesKey, publicKey);
    }
}