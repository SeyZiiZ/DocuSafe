package com.docusafe.exception;

/** Erreur liée aux données envoyées par l'utilisateur (clé, fichier, paramètres) : renvoyée en 400. */
public class CryptoException extends RuntimeException {
    public CryptoException(String message) {
        super(message);
    }
}
