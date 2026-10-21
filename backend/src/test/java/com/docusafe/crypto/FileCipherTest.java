package com.docusafe.crypto;

import com.docusafe.exception.CryptoException;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class FileCipherTest {

    private final FileCipher cipher = new FileCipher();
    private final byte[] content = "Contrat confidentiel — ne pas diffuser".getBytes(StandardCharsets.UTF_8);

    @Test
    void aesKeyRoundTrip() {
        byte[] key = cipher.generateAesKey();
        byte[] encrypted = cipher.encryptWithKey(content, key, "contrat.pdf");

        FileCipher.DecryptedFile decrypted = cipher.decrypt(encrypted, Base64.getEncoder().encodeToString(key), null);

        assertArrayEquals(content, decrypted.data());
        assertEquals("contrat.pdf", decrypted.originalFilename());
        assertEquals(FileCipher.Mode.AES_KEY, decrypted.mode());
    }

    @Test
    void sameInputGivesDifferentCiphertexts() {
        byte[] key = cipher.generateAesKey();
        byte[] first = cipher.encryptWithKey(content, key, "a.txt");
        byte[] second = cipher.encryptWithKey(content, key, "a.txt");

        assertFalse(java.util.Arrays.equals(first, second), "l'IV doit être aléatoire");
    }

    @Test
    void passwordRoundTrip() {
        byte[] encrypted = cipher.encryptWithPassword(content, "mot de passe solide", "notes.txt");

        FileCipher.DecryptedFile decrypted = cipher.decrypt(encrypted, "mot de passe solide", null);

        assertArrayEquals(content, decrypted.data());
        assertEquals(FileCipher.Mode.AES_PASSWORD, cipher.readMode(encrypted));
    }

    @Test
    void wrongPasswordIsRejected() {
        byte[] encrypted = cipher.encryptWithPassword(content, "mot de passe solide", "notes.txt");

        CryptoException e = assertThrows(CryptoException.class, () -> cipher.decrypt(encrypted, "mauvais mot de passe", null));
        assertTrue(e.getMessage().contains("incorrecte"));
    }

    @Test
    void shortPasswordIsRejected() {
        assertThrows(CryptoException.class, () -> cipher.encryptWithPassword(content, "court", "notes.txt"));
    }

    @Test
    void rsaRoundTrip() {
        KeyPair pair = PemKeys.generateRsaKeyPair();
        byte[] encrypted = cipher.encryptWithPublicKey(content, pair.getPublic(), "rapport.docx");

        FileCipher.DecryptedFile decrypted = cipher.decrypt(encrypted, null, pair.getPrivate());

        assertArrayEquals(content, decrypted.data());
        assertEquals("rapport.docx", decrypted.originalFilename());
        assertEquals(FileCipher.Mode.RSA, decrypted.mode());
    }

    @Test
    void rsaWithWrongPrivateKeyIsRejected() {
        KeyPair pair = PemKeys.generateRsaKeyPair();
        KeyPair other = PemKeys.generateRsaKeyPair();
        byte[] encrypted = cipher.encryptWithPublicKey(content, pair.getPublic(), "rapport.docx");

        assertThrows(CryptoException.class, () -> cipher.decrypt(encrypted, null, other.getPrivate()));
    }

    @Test
    void tamperedFileIsRejected() {
        byte[] key = cipher.generateAesKey();
        byte[] encrypted = cipher.encryptWithKey(content, key, "contrat.pdf");
        encrypted[encrypted.length - 1] ^= 1;

        assertThrows(CryptoException.class,
            () -> cipher.decrypt(encrypted, Base64.getEncoder().encodeToString(key), null));
    }

    @Test
    void tamperedFilenameIsRejected() {
        byte[] key = cipher.generateAesKey();
        byte[] encrypted = cipher.encryptWithKey(content, key, "contrat.pdf");
        encrypted[7] = 'X'; // premier caractère du nom (après "DSF1", le mode et la longueur), couvert par l'AAD

        assertThrows(CryptoException.class,
            () -> cipher.decrypt(encrypted, Base64.getEncoder().encodeToString(key), null));
    }

    @Test
    void filenameCannotEscapeTheFolder() {
        byte[] key = cipher.generateAesKey();
        byte[] encrypted = cipher.encryptWithKey(content, key, "..\\..\\Windows/evil.exe");

        FileCipher.DecryptedFile decrypted = cipher.decrypt(encrypted, Base64.getEncoder().encodeToString(key), null);

        assertEquals("evil.exe", decrypted.originalFilename());
    }

    @Test
    void foreignFileIsRejected() {
        CryptoException e = assertThrows(CryptoException.class,
            () -> cipher.decrypt("pas un fichier DocuSafe".getBytes(StandardCharsets.UTF_8), "x", null));
        assertTrue(e.getMessage().contains("DocuSafe"));
    }

    @Test
    void truncatedFileIsRejected() {
        byte[] key = cipher.generateAesKey();
        byte[] encrypted = cipher.encryptWithKey(content, key, "contrat.pdf");
        byte[] truncated = java.util.Arrays.copyOf(encrypted, 20);

        assertThrows(CryptoException.class,
            () -> cipher.decrypt(truncated, Base64.getEncoder().encodeToString(key), null));
    }

    @Test
    void legacyEcbFilesCanStillBeDecrypted() throws Exception {
        // Valeurs produites par l'ancienne version (AES/ECB/PKCS5Padding, sans en-tête)
        byte[] legacy = Base64.getDecoder().decode("K9xM1kcabFUP+r2b5yHuN7S7tCL/PVMSncWGejijw1SwRSL/i4Xhq567LtKBZoJH");
        String key = "U6PN1EEhOCBE0NaXAvRC9jJsrmy5BJmRFSMs6y5N2j4=";

        assertFalse(FileCipher.hasDocuSafeHeader(legacy));
        assertTrue(cipher.decryptLegacy(legacy, key).length > 0);
        assertThrows(CryptoException.class,
            () -> cipher.decryptLegacy(legacy, Base64.getEncoder().encodeToString(new byte[32])));
    }

    @Test
    void pemKeysRoundTrip() {
        KeyPair pair = PemKeys.generateRsaKeyPair();

        assertEquals(pair.getPublic(), PemKeys.parsePublicKey(PemKeys.toPem(pair.getPublic())));
        assertEquals(pair.getPrivate(), PemKeys.parsePrivateKey(PemKeys.toPem(pair.getPrivate())));
    }

    @Test
    void rawKeyDetection() {
        assertTrue(FileCipher.isRawAesKey(Base64.getEncoder().encodeToString(new byte[32])));
        assertFalse(FileCipher.isRawAesKey("mon mot de passe"));
        assertFalse(FileCipher.isRawAesKey(Base64.getEncoder().encodeToString(new byte[10])));
    }
}
