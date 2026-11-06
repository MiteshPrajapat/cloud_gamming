import re
import time
import requests

def get_megadb_direct_url(page_url: str):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://steamrip.com/"
    }
    session = requests.Session()
    print(f"Requesting MegaDB page from server IP: {page_url}")
    r = session.get(page_url, headers=headers)
    print("Page status:", r.status_code)
    
    match = re.search(r"var finalDownloadUrl = '([^']+)'", r.text)
    if not match:
        print("Could not find finalDownloadUrl in page:")
        print(r.text[:500])
        return None

    final_url = match.group(1)
    print(f"Extracted finalDownloadUrl: {final_url}")
    
    print("Waiting 11 seconds for server timer to complete...")
    time.sleep(11)
    
    headers["Referer"] = page_url
    r2 = session.get(final_url, headers=headers, allow_redirects=False)
    print("Timer redirect status:", r2.status_code)
    cdn_url = r2.headers.get("Location")
    print(f"Direct CDN URL: {cdn_url}")
    
    if cdn_url:
        head_r = session.head(cdn_url, headers=headers)
        print("CDN HEAD Status:", head_r.status_code)
        print("Content-Length:", head_r.headers.get("Content-Length"))
        print("Content-Type:", head_r.headers.get("Content-Type"))
        return cdn_url
    return None

if __name__ == "__main__":
    url = "https://megadb.net/c5wbf1n1kwee"
    cdn = get_megadb_direct_url(url)
    if cdn:
        print("\nSUCCESS! Direct CDN URL obtained on EC2:", cdn)
    else:
        print("\nFAILED to obtain direct CDN URL.")
