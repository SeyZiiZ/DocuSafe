from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import base64

# Fichier chiffré 1
encrypted_base64_1 = "K9xM1kcabFUP+r2b5yHuN7S7tCL/PVMSncWGejijw1SwRSL/i4Xhq567LtKBZoJH"
aes_key_base64_1 = "U6PN1EEhOCBE0NaXAvRC9jJsrmy5BJmRFSMs6y5N2j4="

# Fichier chiffré 2
encrypted_base64_2 = "GROUU6/tU0PvA/+6uDD8xG87G8yAwGqrqeh2rsMwkzr3eO40qNR7W89i4zM6fSis"
aes_key_base64_2 = "/+96Dd2VJOcFGd+lhUspODCp+S9ZBwV8p3plBAAf80g="

# Déchiffrement 1
cipher1 = AES.new(base64.b64decode(aes_key_base64_1), AES.MODE_ECB)
decrypted1 = unpad(cipher1.decrypt(base64.b64decode(encrypted_base64_1)), AES.block_size)

# Déchiffrement 2
cipher2 = AES.new(base64.b64decode(aes_key_base64_2), AES.MODE_ECB)
decrypted2 = unpad(cipher2.decrypt(base64.b64decode(encrypted_base64_2)), AES.block_size)

# Comparaison
message1 = decrypted1.decode('utf-8')
message2 = decrypted2.decode('utf-8')

print("Message 1 :", message1)
print("Message 2 :", message2)

if message1 == message2:
    print("✅ Les deux messages déchiffrés sont identiques !")
else:
    print("❌ Les messages déchiffrés sont différents.")