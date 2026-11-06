import time
import requests

BASE_URL = "http://127.0.0.1:8000"

def test_security_ssrf():
    print("\n--- 1. Testing SSRF Protections ---")
    
    # 1. AWS EC2 metadata IP
    r1 = requests.post(f"{BASE_URL}/api/admin/games/download", json={
        "name": "Test SSRF Metadata",
        "download_url": "http://169.254.169.254/latest/meta-data/",
        "platform": "linux",
        "category": "Action"
    })
    print("AWS Metadata IP Blocked:", r1.status_code, r1.json().get("detail"))
    assert r1.status_code == 400

    # 2. Localhost
    r2 = requests.post(f"{BASE_URL}/api/admin/games/download", json={
        "name": "Test SSRF Localhost",
        "download_url": "http://127.0.0.1:8000/api/server/status",
        "platform": "linux",
        "category": "Action"
    })
    print("Localhost Blocked:", r2.status_code, r2.json().get("detail"))
    assert r2.status_code == 400

    # 3. Private subnet
    r3 = requests.post(f"{BASE_URL}/api/admin/games/download", json={
        "name": "Test SSRF Private Subnet",
        "download_url": "http://10.0.0.5/game.zip",
        "platform": "linux",
        "category": "Action"
    })
    print("Private Subnet Blocked:", r3.status_code, r3.json().get("detail"))
    assert r3.status_code == 400

def test_storage_api():
    print("\n--- 2. Testing Storage Metrics API ---")
    r = requests.get(f"{BASE_URL}/api/admin/storage")
    print("Storage API:", r.status_code, r.json())
    assert r.status_code == 200
    data = r.json()
    assert "total_gb" in data and "free_gb" in data

def test_download_and_install_flow():
    print("\n--- 3. Testing Download and Auto-Install Flow ---")
    # Download a real public test zip (e.g. from GitHub releases or public archive)
    test_url = "https://raw.githubusercontent.com/MiteshPrajapat/cloud_gamming/main/README.md"
    
    # First, let's create a real lightweight test game archive using direct executable / small archive
    # Let's test with a publicly accessible lightweight open-source test zip:
    # e.g., github releases or a direct URL
    game_url = "https://raw.githubusercontent.com/curl/curl/master/docs/THANKS"
    
    # Let's test with an actual open-source game or zip:
    # We can host a quick local test zip on a public HTTP test service, or test downloading a known open-source archive
    # e.g., https://github.com/libsdl-org/SDL/archive/refs/tags/release-2.0.0.zip (small)
    sample_url = "https://github.com/libsdl-org/SDL/archive/refs/tags/release-2.0.0.zip"
    
    print(f"Submitting download job for URL: {sample_url}")
    r = requests.post(f"{BASE_URL}/api/admin/games/download", json={
        "name": "SDL2 Release Sample",
        "download_url": sample_url,
        "description": "Auto-downloaded sample game archive",
        "platform": "linux",
        "category": "Arcade",
        "auto_install": True
    })
    print("Download Create Status:", r.status_code)
    job = r.json()
    print("Created Download Job:", job.get("id"), "Status:", job.get("status"))
    assert r.status_code == 202

    download_id = job["id"]

    # Poll status for progress
    for _ in range(30):
        time.sleep(1)
        st = requests.get(f"{BASE_URL}/api/admin/games/download/{download_id}").json()
        print(f"Download Progress: {st.get('progress')}% | Status: {st.get('status')} | Speed: {st.get('download_speed_mbps')} MB/s")
        if st.get("status") in ("completed", "failed", "cancelled"):
            break

    # Check downloads list
    all_jobs = requests.get(f"{BASE_URL}/api/admin/games/downloads").json()
    print(f"Total downloads on server: {len(all_jobs)}")

if __name__ == "__main__":
    test_security_ssrf()
    test_storage_api()
    test_download_and_install_flow()
    print("\nALL AUTOMATIC GAME DOWNLOADER TESTS PASSED!")
