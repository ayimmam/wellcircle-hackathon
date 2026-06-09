import hmac
import hashlib
import urllib.parse
import json
import time

bot_token = "8839515595:AAGwLHPgbxuvvoBiZrCbBnKFQBNlPtouBGI"
user_data = {
    "id": 12345678,
    "first_name": "Test",
    "last_name": "User",
    "username": "testuser"
}

auth_date = int(time.time())
data_check_string = f"auth_date={auth_date}\nuser={json.dumps(user_data, separators=(',', ':'))}"
secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
hash_val = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

init_data = f"query_id=123&user={urllib.parse.quote(json.dumps(user_data, separators=(',', ':')))}&auth_date={auth_date}&hash={hash_val}"
print("INIT DATA:", init_data)
