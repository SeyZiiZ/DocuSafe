package com.docusafe.controller;

import com.docusafe.model.KeyPairResponse;
import com.docusafe.service.KeyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class KeyController {

    private final KeyService keyService;

    @Autowired
    public KeyController(KeyService keyService) {
        this.keyService = keyService;
    }

    @PostMapping("/keys/rsa")
    public ResponseEntity<KeyPairResponse> generateRsaKeyPair() {
        return ResponseEntity.ok(keyService.generateRsaKeyPair());
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
