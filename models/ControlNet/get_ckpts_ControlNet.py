import os
import requests
from tqdm import tqdm

# URLs and destinations
downloads = [
    ("https://huggingface.co/lllyasviel/ControlNet/resolve/main/models/control_sd15_canny.pth",
     "src/models/control_sd15_canny.pth"),
]

# Create ckpt folder if it doesn't exist
os.makedirs("src/models", exist_ok=True)

def download_with_tqdm(url, destination):
    """Download a file with a tqdm progress bar."""
    response = requests.head(url, allow_redirects=True)
    total_size = int(response.headers.get('content-length', 0))

    with requests.get(url, stream=True) as r, open(destination, 'wb') as f, tqdm(
            total=total_size, unit='B', unit_scale=True, desc=os.path.basename(destination)) as pbar:
        for chunk in r.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                pbar.update(len(chunk))
    print(f"Downloaded {destination}")

for url, destination in downloads:
    download_with_tqdm(url, destination)
