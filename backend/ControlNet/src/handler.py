import cv2
import einops
import numpy as np
import torch
import random
import runpod
import base64
import requests

from io import BytesIO
from PIL import Image
from pytorch_lightning import seed_everything
from annotator.util import resize_image, HWC3
from annotator.canny import CannyDetector
from cldm.model import create_model, load_state_dict
from cldm.ddim_hacked import DDIMSampler


apply_canny = CannyDetector()

model = create_model('./models/cldm_v15.yaml').cpu()
model.load_state_dict(load_state_dict('./models/control_sd15_canny.pth', location='cuda'))
model = model.cuda()
ddim_sampler = DDIMSampler(model)

class Config:
    def __init__(self):
        self.save_memory = False

config = Config()

def load_image_from_base64(base64_str: str):
    image_bytes = base64.b64decode(base64_str)
    image = Image.open(BytesIO(image_bytes)).convert('RGB')
    return image

def load_image(image_file: str):
    if image_file.startswith('http://') or image_file.startswith('https://'):
        response = requests.get(image_file)
        image = Image.open(BytesIO(response.content)).convert('RGB')
    else:
        image = load_image_from_base64(image_file)
    return image


def process(input_image, prompt, a_prompt, n_prompt, num_samples, image_resolution, ddim_steps, guess_mode, strength, scale, seed, eta, low_threshold, high_threshold):
    with torch.no_grad():
        img = resize_image(HWC3(input_image), image_resolution)
        H, W, C = img.shape

        detected_map = apply_canny(img, low_threshold, high_threshold)
        detected_map = HWC3(detected_map)

        control = torch.from_numpy(detected_map.copy()).float().cuda() / 255.0
        control = torch.stack([control for _ in range(num_samples)], dim=0)
        control = einops.rearrange(control, 'b h w c -> b c h w').clone()

        if seed == -1:
            seed = random.randint(0, 65535)
        seed_everything(seed)

        if config.save_memory:
            model.low_vram_shift(is_diffusing=False)

        cond = {"c_concat": [control], "c_crossattn": [model.get_learned_conditioning([prompt + ', ' + a_prompt] * num_samples)]}
        un_cond = {"c_concat": None if guess_mode else [control], "c_crossattn": [model.get_learned_conditioning([n_prompt] * num_samples)]}
        shape = (4, H // 8, W // 8)

        if config.save_memory:
            model.low_vram_shift(is_diffusing=True)

        model.control_scales = [strength * (0.825 ** float(12 - i)) for i in range(13)] if guess_mode else ([strength] * 13)  # Magic number. IDK why. Perhaps because 0.825**12<0.01 but 0.826**12>0.01
        samples, intermediates = ddim_sampler.sample(ddim_steps, num_samples,
                                                     shape, cond, verbose=False, eta=eta,
                                                     unconditional_guidance_scale=scale,
                                                     unconditional_conditioning=un_cond)

        if config.save_memory:
            model.low_vram_shift(is_diffusing=False)

        x_samples = model.decode_first_stage(samples)
        x_samples = (einops.rearrange(x_samples, 'b c h w -> b h w c') * 127.5 + 127.5).cpu().numpy().clip(0, 255).astype(np.uint8)

        results = [x_samples[i] for i in range(num_samples)]

    return results


def handler(job):
    job_input = job["input"]

    image = np.asarray(load_image(job_input["base_image"]))
    prompt = job_input["target_prompt"]
    image_resolution = 512
    strength = float(job_input["image_scale"])
    scale = float(job_input["guidance_scale"])
    low_tresh = 50
    high_thresh = 200
    steps = int(job_input["ddim_steps"])

    generated_image = Image.fromarray(process(
        input_image = image,
        prompt = prompt,
        a_prompt = "best quality, extremely detailed",
        n_prompt = "longbody, lowres, bad anatomy, bad hands, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality",
        num_samples = 1,
        image_resolution = image_resolution,
        ddim_steps = steps,
        guess_mode = False,
        strength = strength,
        scale = scale,
        seed = -1,
        eta = 0.0,
        low_threshold = low_tresh,
        high_threshold = high_thresh
    )[0], "RGB")

    bytes = BytesIO()
    generated_image.save(bytes, format = "PNG")

    return base64.b64encode(bytes.getvalue()).decode("utf-8")

if __name__ == '__main__':
    runpod.serverless.start({'handler': handler})