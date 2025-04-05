from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import base64

# Données de ton JSON
encrypted_base64 = "HPaAaJo4+d/hgDrogLQSLifY8AgZMW50ThvNzJR/M0olAIAJkyt+ZN+pphAdSupt"
aes_key_base64 = "VjYq9R0WIbJ25l6Dymfea0smUu2Mb9mq+MQa47jUaoI="

# Décodage Base64
encrypted_bytes = base64.b64decode(encrypted_base64)
aes_key = base64.b64decode(aes_key_base64)

# Déchiffrement AES
cipher = AES.new(aes_key, AES.MODE_ECB)
decrypted = unpad(cipher.decrypt(encrypted_bytes), AES.block_size)

# Résultat
print("Message déchiffré :", decrypted.decode('utf-8'))