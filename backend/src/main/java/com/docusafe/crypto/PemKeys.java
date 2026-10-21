package com.docusafe.crypto;

import com.docusafe.exception.CryptoException;

import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/** Génération et conversion PEM des clés RSA (X.509 pour la publique, PKCS#8 pour la privée). */
public final class PemKeys {

    private static final int RSA_KEY_SIZE = 3072;

    private PemKeys() {}

    public static KeyPair generateRsaKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(RSA_KEY_SIZE);
            return generator.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Génération RSA indisponible", e);
        }
    }

    public static String toPem(PublicKey key) {
        return pem("PUBLIC KEY", key.getEncoded());
    }

    public static String toPem(PrivateKey key) {
        return pem("PRIVATE KEY", key.getEncoded());
    }

    public static PublicKey parsePublicKey(String pem) {
        try {
            return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(decode(pem, "publique")));
        } catch (GeneralSecurityException e) {
            throw new CryptoException("Clé publique RSA invalide");
        }
    }

    public static PrivateKey parsePrivateKey(String pem) {
        if (pem != null && pem.contains("BEGIN RSA PRIVATE KEY")) {
            throw new CryptoException("Format PKCS#1 non supporté : convertissez la clé avec « openssl pkcs8 -topk8 -nocrypt »");
        }
        try {
            return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(decode(pem, "privée")));
        } catch (GeneralSecurityException e) {
            throw new CryptoException("Clé privée RSA invalide");
        }
    }

    private static byte[] decode(String pem, String kind) {
        if (pem == null || pem.isBlank()) {
            throw new CryptoException("Clé " + kind + " RSA manquante");
        }
        String body = pem.replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
        try {
            return Base64.getDecoder().decode(body);
        } catch (IllegalArgumentException e) {
            throw new CryptoException("Clé " + kind + " RSA invalide (Base64 attendu)");
        }
    }

    private static String pem(String type, byte[] der) {
        String body = Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(der);
        return "-----BEGIN " + type + "-----\n" + body + "\n-----END " + type + "-----\n";
    }
}
