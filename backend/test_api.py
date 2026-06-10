import hmac
import hashlib
import urllib.parse
import json
import time
import urllib.request
import urllib.error

bot_token = ""
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

print("Authenticating with:", init_data)
req = urllib.request.Request("https://wellcircle-hackathon-backend.vercel.app/api/auth/telegram", data=json.dumps({"init_data": init_data}).encode(), headers={"Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        token = data["token"]
        print("Got token!")
except urllib.error.HTTPError as e:
    print("Auth failed:", e.code, e.read().decode())
    exit(1)

print("Fetching providers...")
req2 = urllib.request.Request("https://wellcircle-hackathon-backend.vercel.app/api/providers", headers={"Authorization": f"Bearer {token}"})
try:
    with urllib.request.urlopen(req2) as response2:
        data2 = json.loads(response2.read().decode())
        print("Count:", data2.get("count"))
except urllib.error.HTTPError as e:
    print(e.read().decode())
