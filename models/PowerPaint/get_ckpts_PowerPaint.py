import os
import subprocess

# REQUIRES git-lfs

# Target directory
destination_dir = "src/checkpoints/ppt-v2"
os.makedirs(destination_dir, exist_ok=True)

# Git LFS clone command
command = ["git", "lfs", "clone", "https://huggingface.co/JunhaoZhuang/PowerPaint_v2/", destination_dir]

try:
    subprocess.run(command, check=True)
    print(f"Repository cloned successfully into {destination_dir}")
except subprocess.CalledProcessError as e:
    print(f"Error cloning repository: {e}")
