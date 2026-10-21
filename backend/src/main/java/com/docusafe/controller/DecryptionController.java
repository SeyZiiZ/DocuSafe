package com.docusafe.controller;

import com.docusafe.model.DecryptionResponse;
import com.docusafe.service.DecryptionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api")
public class DecryptionController {

    private final DecryptionService decryptionService;

    @Autowired
    public DecryptionController(DecryptionService decryptionService) {
        this.decryptionService = decryptionService;
    }

    @PostMapping("/decryption")
    public ResponseEntity<DecryptionResponse> receiveFile(
        @RequestParam("file") MultipartFile file,
        @RequestParam(value = "aesKey", required = false) String aesKey,
        @RequestParam(value = "privateKey", required = false) String privateKey
    ) throws IOException {
        return ResponseEntity.ok(decryptionService.processFile(file, aesKey, privateKey));
    }
}
