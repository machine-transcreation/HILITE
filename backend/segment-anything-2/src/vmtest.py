import numpy as np
import torch
import matplotlib.pyplot as plt
from PIL import Image
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor
from io import BytesIO
import requests
import base64
import os
import io
import json


def init_device():
    global device
    if torch.cuda.is_available():
        device = torch.device("cuda")
    elif torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")
        return device

def load_models():
    global sam2_model
    global predictor
    sam2_checkpoint = "/"+os.path.abspath("checkpoints/sam2_hiera_large.pt")
    model_cfg = "/"+os.path.abspath("sam2_configs/sam2_hiera_l.yaml")

    sam2_model = build_sam2(model_cfg, sam2_checkpoint, device=device)

    predictor = SAM2ImagePredictor(sam2_model)
    return sam2_model, predictor

def load_image_from_base64(base64_str: str) -> Image.Image:
    image_bytes = base64.b64decode(base64_str)
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    return image

def load_image(image_file: str) -> Image.Image:
    if image_file.startswith('https://') or image_file.startswith('http://'):
        response = requests.get(image_file)
        image = Image.open(BytesIO(response.content)).convert("RGB")
    else:
        image = load_image_from_base64(image_file)
    return image

def create_colored_mask_image(mask, R, G, B, A): # returns RGBA image of mask 
    
    R, G, B, A = map(lambda x: max(0, min(255, x)), [R, G, B, A])
    
    if mask.ndim > 2:
        mask = mask[0]

    mask = (mask > 0).astype(np.uint8)
    height, width = mask.shape
    rgba_image = np.zeros((height, width, 4), dtype=np.uint8)

    rgba_image[mask == 1] = [R, G, B, A]
    image = Image.fromarray(rgba_image, 'RGBA')
    
    return image

def pil_image_to_base64(image: Image.Image) -> str:
    
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
    return img_str

def handler(job):
    
    device = init_device()
    sam2_model, predictor = load_models()

    input = job["input"]
    image_b64 = input["image"]
    image = load_image(image_b64)

    R, G, B, A = input["R"], input["G"], input["B"], input["A"]

    coord1, coord2 = input["coord1"], input["coord2"]
    x1, y1 = coord1["x"], coord1["y"]
    x2, y2 = coord2["x"], coord2["y"]

    input_box = np.array([x1, y1, x2, y2])

    predictor.set_image(image)

    masks, confidence, _ = predictor.predict(
        point_coords=None,
        point_labels=None,
        box=input_box[None, :],
        multimask_output=False,
    )

    mask = create_colored_mask_image(masks, R, G, B, A)
    mask_b64 = pil_image_to_base64(mask)
    
    return {"mask" : mask_b64}

def main():
    with open('test_input.json', 'r') as infile:
        input_dict = json.load(infile)
    output_dict = handler(input_dict)
    with open('test_output.json', 'w') as outfile:
        json.dump(output_dict, outfile, indent=4)

main()
