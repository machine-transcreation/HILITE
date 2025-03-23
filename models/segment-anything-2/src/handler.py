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
import runpod
import cv2

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

def mask_to_pillow(image, mask, borders=True):
    color = np.array([30/255, 144/255, 255/255, 0.6])
    
    h, w = mask.shape[-2:]
    mask = mask.astype(np.uint8)
    mask_image = mask.reshape(h, w, 1) * color.reshape(1, 1, -1)
    
    if borders:
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        contours = [cv2.approxPolyDP(contour, epsilon=0.01, closed=True) for contour in contours]
        mask_image = cv2.drawContours(mask_image, contours, -1, (1, 1, 1, 0.5), thickness=2)
    
    plt.figure(figsize=(10, 10))
    plt.imshow(image)
    plt.imshow(mask_image, alpha=0.6)
    plt.axis('off')
    
    buf = BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0)
    buf.seek(0)
    
    pil_image = Image.open(buf)
    buf.seek(0) 
    plt.close()  
    
    return pil_image

def handler(job):
    
    device = init_device()
    sam2_model, predictor = load_models()

    input = job["input"]
    image_b64 = input["image"]
    image = load_image(image_b64)
    R = input["R"]
    G = input["G"]
    B = input["B"]
    A = input["A"]

    orig_width, orig_height = image.size

    image = image.resize((512, 512))

    points = np.array(input["points"])
    labels = np.array(input["labels"])

    predictor.set_image(image)

    masks, confidence, _ = predictor.predict(
        point_coords=points,
        point_labels=labels,
        multimask_output=False,
    )

    mask = create_colored_mask_image(mask = masks, R = R, G = G, B = B, A = A).resize((orig_width, orig_height))
    mask_b64 = pil_image_to_base64(mask)
    
    return {"mask" : mask_b64}

if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})