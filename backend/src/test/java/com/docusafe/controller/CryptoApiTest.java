package com.docusafe.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class CryptoApiTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    private final byte[] content = "Bulletin de salaire".getBytes(StandardCharsets.UTF_8);

    @Test
    void encryptThenDecryptWithGeneratedAesKey() throws Exception {
        JsonNode encrypted = encrypt("AES", null, null);
        String aesKey = encrypted.get("aesKey").asText();
        assertFalse(encrypted.has("privateKey"));

        JsonNode decrypted = decrypt(encrypted, "aesKey", aesKey);

        assertEquals("salaire.pdf", decrypted.get("originalFilename").asText());
        assertEquals("AES", decrypted.get("encryptionType").asText());
        assertArrayEquals(content, Base64.getDecoder().decode(decrypted.get("decryptedFileBase64").asText()));
    }

    @Test
    void encryptThenDecryptWithPassword() throws Exception {
        JsonNode encrypted = encrypt("AES", "un mot de passe long", null);
        assertFalse(encrypted.has("aesKey"), "le mot de passe ne doit pas être renvoyé");

        JsonNode decrypted = decrypt(encrypted, "aesKey", "un mot de passe long");

        assertArrayEquals(content, Base64.getDecoder().decode(decrypted.get("decryptedFileBase64").asText()));
    }

    @Test
    void encryptThenDecryptWithRsa() throws Exception {
        JsonNode keys = mapper.readTree(mvc.perform(post("/api/keys/rsa"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());

        JsonNode encrypted = encrypt("RSA", null, keys.get("publicKey").asText());
        JsonNode decrypted = decrypt(encrypted, "privateKey", keys.get("privateKey").asText());

        assertEquals("RSA", decrypted.get("encryptionType").asText());
        assertArrayEquals(content, Base64.getDecoder().decode(decrypted.get("decryptedFileBase64").asText()));
    }

    @Test
    void rsaWithoutPublicKeyGeneratesAPair() throws Exception {
        JsonNode encrypted = encrypt("RSA", null, null);
        assertTrue(encrypted.get("publicKey").asText().startsWith("-----BEGIN PUBLIC KEY-----"));

        JsonNode decrypted = decrypt(encrypted, "privateKey", encrypted.get("privateKey").asText());

        assertArrayEquals(content, Base64.getDecoder().decode(decrypted.get("decryptedFileBase64").asText()));
    }

    @Test
    void wrongKeyReturnsJsonError() throws Exception {
        JsonNode encrypted = encrypt("AES", null, null);
        String otherKey = Base64.getEncoder().encodeToString(new byte[32]);

        mvc.perform(multipart("/api/decryption")
                .file(encryptedFile(encrypted))
                .param("aesKey", otherKey))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Clé incorrecte ou fichier altéré"));
    }

    @Test
    void unknownEncryptionTypeIsRejected() throws Exception {
        mvc.perform(multipart("/api/encryption")
                .file(new MockMultipartFile("file", "a.txt", "text/plain", content))
                .param("encryptionType", "DES"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void missingFileIsRejected() throws Exception {
        mvc.perform(multipart("/api/encryption").param("encryptionType", "AES"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Paramètre manquant : file"));
    }

    @Test
    void healthEndpoint() throws Exception {
        mvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UP"));
    }

    private JsonNode encrypt(String type, String aesKey, String publicKey) throws Exception {
        var request = multipart("/api/encryption")
            .file(new MockMultipartFile("file", "salaire.pdf", "application/pdf", content))
            .param("encryptionType", type);
        if (aesKey != null) request.param("aesKey", aesKey);
        if (publicKey != null) request.param("publicKey", publicKey);

        return mapper.readTree(mvc.perform(request)
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
    }

    private JsonNode decrypt(JsonNode encrypted, String keyParam, String key) throws Exception {
        return mapper.readTree(mvc.perform(multipart("/api/decryption")
                .file(encryptedFile(encrypted))
                .param(keyParam, key))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private MockMultipartFile encryptedFile(JsonNode encrypted) {
        byte[] bytes = Base64.getDecoder().decode(encrypted.get("encryptedFileBase64").asText());
        return new MockMultipartFile("file", "salaire.pdf.encrypted", "application/octet-stream", bytes);
    }
}
