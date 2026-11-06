import time
import requests
import json

BASE_URL = "http://127.0.0.1:8000"

payload = {
    "name": "Grand Theft Auto: San Andreas",
    "download_url": "https://megadb.net/c5wbf1n1kwee",
    "description": "Iconic open-world action-adventure game set in early 90s San Andreas. Follow CJ as he takes back the streets of Los Santos.",
    "thumbnail": "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80",
    "platform": "windows",
    "category": "Action",
    "archive_type": "rar",
    "auto_install": True,
    "supported_controls": ["keyboard", "touch_joystick", "gamepad"]
}

print("Submitting GTA San Andreas download request via MegaDB link...")
r = requests.post(f"{BASE_URL}/api/admin/games/download", json=payload)
print("HTTP Status:", r.status_code)
data = r.json()
print("Response Data:", json.dumps(data, indent=2))

if r.status_code == 202:
    job_id = data["id"]
    print(f"\nMonitoring download job: {job_id}")
    for i in range(25): # Monitor for 50 seconds to confirm stream is active and progressing
        time.sleep(2)
        st = requests.get(f"{BASE_URL}/api/admin/games/download/{job_id}").json()
        status = st.get("status")
        prog = st.get("progress")
        mb = st.get("downloaded_mb")
        tot = st.get("total_mb")
        spd = st.get("download_speed_mbps")
        eta = st.get("eta_seconds")
        print(f"[{i*2}s] Status: {status} | Progress: {prog}% ({mb}/{tot} MB) | Speed: {spd} MB/s | ETA: {eta}s")
        if status in ("completed", "failed", "cancelled"):
            print("Download process reached terminal state:", status)
            if st.get("error_message"):
                print("Error details:", st.get("error_message"))
            break
