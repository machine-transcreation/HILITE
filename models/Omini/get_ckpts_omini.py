import os
import requests
from tqdm import tqdm

# Define the download source and target path
downloads = [
    # TODO: update the URL to the actual model checkpoint location if different
    ("https://huggingface.co/Yuanshi/OminiControl/resolve/main/omini/subject_512.safetensors",
     "checkpoints/omini.pth")
]

# Create the checkpoints directory if it doesn't exist
os.makedirs("checkpoints", exist_ok=True)

def download_with_tqdm(url, destination):
    """Download a file with a tqdm progress bar."""
    response = requests.head(url, allow_redirects=True)
    total_size = int(response.headers.get("content-length", 0))
    with requests.get(url, stream=True) as r, open(destination, "wb") as f, tqdm(
            total=total_size, unit="B", unit_scale=True, desc=os.path.basename(destination)) as pbar:
        for chunk in r.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                pbar.update(len(chunk))
    print(f"Downloaded {destination}")

# Download each specified file
for url, dest in downloads:
    download_with_tqdm(url, dest)
