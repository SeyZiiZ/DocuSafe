package com.docusafe.service;

import com.docusafe.crypto.PemKeys;
import com.docusafe.model.KeyPairResponse;

import org.springframework.stereotype.Service;

import java.security.KeyPair;

@Service
public class KeyService {

    public KeyPairResponse generateRsaKeyPair() {
        KeyPair pair = PemKeys.generateRsaKeyPair();
        return new KeyPairResponse(PemKeys.toPem(pair.getPublic()), PemKeys.toPem(pair.getPrivate()));
    }
}
