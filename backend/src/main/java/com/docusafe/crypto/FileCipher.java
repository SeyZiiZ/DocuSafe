package com.docusafe.crypto;

import com.docusafe.exception.CryptoException;
import org.springframework.stereotype.Component;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.PSource;
import javax.crypto.spec.SecretKeySpec;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.BufferUnderflowException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.spec.MGF1ParameterSpec;
import java.util.Arrays;
import java.util.Base64;

/**
 * Chiffrement des fichiers DocuSafe (.encrypted).
 *
 * Format binaire :
 * <pre>
 *   "DSF1" | mode (1 octet) | longueur du nom (2) | nom d'origine (UTF-8)
 *   | [mode AES_PASSWORD] sel PBKDF2 (16)
 *   | [mode RSA] longueur de la clé enveloppée (2) | clé AES chiffrée en RSA-OAEP
 *   | IV (12) | données chiffrées AES-256-GCM + tag (16)
 * </pre>
 * Tout l'en-tête est authentifié par GCM (AAD) : le nom et le mode ne peuvent pas être modifiés.
 */
@Component
public class FileCipher {

    public enum Mode {
        AES_KEY(1), AES_PASSWORD(2), RSA(3);

        private final byte code;

        Mode(int code) {
            this.code = (byte) code;
        }

        static Mode fromCode(byte code) {
            for (Mode mode : values()) {
                if (mode.code == code) return mode;
            }
            throw new CryptoException("Mode de chiffrement inconnu dans le fichier");
        }
    }

    public record DecryptedFile(String originalFilename, Mode mode, byte[] data) {}

    private record Header(Mode mode, String filename, byte[] salt, byte[] wrappedKey, byte[] aad, byte[] iv, int dataOffset) {}

    private static final byte[] MAGIC = "DSF1".getBytes(StandardCharsets.US_ASCII);
    private static final int IV_LENGTH = 12;
    private static final int TAG_BITS = 128;
    private static final int SALT_LENGTH = 16;
    private static final int PBKDF2_ITERATIONS = 310_000;
    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final String AES_GCM = "AES/GCM/NoPadding";
    private static final String RSA_OAEP = "RSA/ECB/OAEPPadding";
    private static final OAEPParameterSpec OAEP_SHA256 = new OAEPParameterSpec(
        "SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT);

    private final SecureRandom random = new SecureRandom();

    public byte[] generateAesKey() {
        return randomBytes(32);
    }

    /** Vrai si la chaîne est une clé AES brute encodée en Base64 (128, 192 ou 256 bits). */
    public static boolean isRawAesKey(String value) {
        return decodeRawKey(value) != null;
    }

    public byte[] encryptWithKey(byte[] data, byte[] key, String filename) {
        return seal(Mode.AES_KEY, filename, new byte[0], aesKey(key), data);
    }

    public byte[] encryptWithPassword(byte[] data, String password, String filename) {
        if (password == null || password.length() < MIN_PASSWORD_LENGTH) {
            throw new CryptoException("Le mot de passe doit contenir au moins " + MIN_PASSWORD_LENGTH + " caractères");
        }
        byte[] salt = randomBytes(SALT_LENGTH);
        return seal(Mode.AES_PASSWORD, filename, salt, deriveKey(password, salt), data);
    }

    public byte[] encryptWithPublicKey(byte[] data, PublicKey publicKey, String filename) {
        byte[] fileKey = generateAesKey();
        try {
            Cipher rsa = Cipher.getInstance(RSA_OAEP);
            rsa.init(Cipher.ENCRYPT_MODE, publicKey, OAEP_SHA256);
            byte[] wrapped = rsa.doFinal(fileKey);

            ByteBuffer extra = ByteBuffer.allocate(2 + wrapped.length);
            extra.putShort((short) wrapped.length).put(wrapped);
            return seal(Mode.RSA, filename, extra.array(), aesKey(fileKey), data);
        } catch (GeneralSecurityException e) {
            throw new CryptoException("Clé publique RSA inutilisable : " + e.getMessage());
        } finally {
            Arrays.fill(fileKey, (byte) 0);
        }
    }

    /** Lit le mode d'un fichier chiffré sans le déchiffrer. */
    public Mode readMode(byte[] encrypted) {
        return parse(encrypted).mode();
    }

    public static boolean hasDocuSafeHeader(byte[] encrypted) {
        return encrypted.length >= MAGIC.length && Arrays.equals(Arrays.copyOf(encrypted, MAGIC.length), MAGIC);
    }

    /** Fichiers produits par les premières versions de DocuSafe : AES/ECB sans en-tête, clé Base64. */
    public byte[] decryptLegacy(byte[] encrypted, String base64Key) {
        byte[] raw = decodeRawKey(base64Key);
        if (raw == null) throw new CryptoException("Ce fichier (ancien format) nécessite la clé AES (Base64) générée lors du chiffrement");
        try {
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, aesKey(raw));
            return cipher.doFinal(encrypted);
        } catch (GeneralSecurityException e) {
            throw new CryptoException("Clé incorrecte ou fichier qui n'a pas été chiffré par DocuSafe");
        }
    }

    /**
     * @param secret clé AES Base64 (mode AES_KEY) ou mot de passe (mode AES_PASSWORD)
     * @param privateKey clé privée RSA (mode RSA)
     */
    public DecryptedFile decrypt(byte[] encrypted, String secret, PrivateKey privateKey) {
        Header header = parse(encrypted);
        SecretKey key = switch (header.mode()) {
            case AES_KEY -> {
                byte[] raw = decodeRawKey(secret);
                if (raw == null) throw new CryptoException("Ce fichier nécessite la clé AES (Base64) générée lors du chiffrement");
                yield aesKey(raw);
            }
            case AES_PASSWORD -> {
                if (secret == null || secret.isEmpty()) throw new CryptoException("Ce fichier nécessite le mot de passe utilisé lors du chiffrement");
                yield deriveKey(secret, header.salt());
            }
            case RSA -> {
                if (privateKey == null) throw new CryptoException("Ce fichier nécessite votre clé privée RSA");
                yield unwrapKey(header.wrappedKey(), privateKey);
            }
        };

        try {
            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, header.iv()));
            cipher.updateAAD(header.aad());
            byte[] data = cipher.doFinal(encrypted, header.dataOffset(), encrypted.length - header.dataOffset());
            return new DecryptedFile(header.filename(), header.mode(), data);
        } catch (AEADBadTagException e) {
            throw new CryptoException("Clé incorrecte ou fichier altéré");
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Déchiffrement AES-GCM indisponible", e);
        }
    }

    private byte[] seal(Mode mode, String filename, byte[] extraHeader, SecretKey key, byte[] data) {
        try {
            byte[] name = safeFilename(filename).getBytes(StandardCharsets.UTF_8);
            ByteArrayOutputStream headerBytes = new ByteArrayOutputStream();
            DataOutputStream header = new DataOutputStream(headerBytes);
            header.write(MAGIC);
            header.writeByte(mode.code);
            header.writeShort(name.length);
            header.write(name);
            header.write(extraHeader);
            byte[] aad = headerBytes.toByteArray();

            byte[] iv = randomBytes(IV_LENGTH);
            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            cipher.updateAAD(aad);
            byte[] encrypted = cipher.doFinal(data);

            return ByteBuffer.allocate(aad.length + iv.length + encrypted.length)
                .put(aad).put(iv).put(encrypted)
                .array();
        } catch (IOException | GeneralSecurityException e) {
            throw new IllegalStateException("Chiffrement AES-GCM indisponible", e);
        }
    }

    private Header parse(byte[] blob) {
        try {
            ByteBuffer buffer = ByteBuffer.wrap(blob);
            byte[] magic = new byte[MAGIC.length];
            buffer.get(magic);
            if (!Arrays.equals(magic, MAGIC)) {
                throw new CryptoException("Ce fichier n'a pas été chiffré par DocuSafe");
            }

            Mode mode = Mode.fromCode(buffer.get());
            byte[] name = new byte[Short.toUnsignedInt(buffer.getShort())];
            buffer.get(name);

            byte[] salt = null;
            byte[] wrappedKey = null;
            if (mode == Mode.AES_PASSWORD) {
                salt = new byte[SALT_LENGTH];
                buffer.get(salt);
            } else if (mode == Mode.RSA) {
                wrappedKey = new byte[Short.toUnsignedInt(buffer.getShort())];
                buffer.get(wrappedKey);
            }

            int aadLength = buffer.position();
            byte[] iv = new byte[IV_LENGTH];
            buffer.get(iv);
            if (buffer.remaining() < TAG_BITS / 8) {
                throw new CryptoException("Fichier chiffré tronqué ou corrompu");
            }

            String filename = safeFilename(new String(name, StandardCharsets.UTF_8));
            return new Header(mode, filename, salt, wrappedKey, Arrays.copyOf(blob, aadLength), iv, buffer.position());
        } catch (BufferUnderflowException e) {
            throw new CryptoException("Fichier chiffré tronqué ou corrompu");
        }
    }

    private SecretKey unwrapKey(byte[] wrappedKey, PrivateKey privateKey) {
        try {
            Cipher rsa = Cipher.getInstance(RSA_OAEP);
            rsa.init(Cipher.DECRYPT_MODE, privateKey, OAEP_SHA256);
            return aesKey(rsa.doFinal(wrappedKey));
        } catch (GeneralSecurityException e) {
            throw new CryptoException("Clé privée RSA incorrecte pour ce fichier");
        }
    }

    private SecretKey deriveKey(String password, byte[] salt) {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, PBKDF2_ITERATIONS, 256);
        try {
            byte[] key = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
            return new SecretKeySpec(key, "AES");
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("PBKDF2 indisponible", e);
        } finally {
            spec.clearPassword();
        }
    }

    private static SecretKey aesKey(byte[] raw) {
        if (raw.length != 16 && raw.length != 24 && raw.length != 32) {
            throw new CryptoException("Une clé AES doit faire 128, 192 ou 256 bits");
        }
        return new SecretKeySpec(raw, "AES");
    }

    private static byte[] decodeRawKey(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            byte[] raw = Base64.getDecoder().decode(value.trim());
            return (raw.length == 16 || raw.length == 24 || raw.length == 32) ? raw : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Ne garde que le nom du fichier : un en-tête forgé ne doit pas pouvoir désigner un autre dossier. */
    private static String safeFilename(String filename) {
        if (filename == null) return "document";
        String name = filename.substring(Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\')) + 1)
            .replaceAll("[\\x00-\\x1f<>:\"|?*]", "_")
            .trim();
        if (name.isEmpty() || name.equals(".") || name.equals("..")) return "document";
        return name.length() > 255 ? name.substring(0, 255) : name;
    }

    private byte[] randomBytes(int length) {
        byte[] bytes = new byte[length];
        random.nextBytes(bytes);
        return bytes;
    }
}
