from __future__ import annotations

import math
import random
import sys

import einops
import k_diffusion as K
import numpy as np
import torch
import torch.nn as nn
from einops import rearrange
from omegaconf import OmegaConf
from PIL import Image, ImageOps
from torch import autocast
from io import BytesIO
import cv2

sys.path.append("./stable_diffusion")

from stable_diffusion.ldm.util import instantiate_from_config
from typing import Optional
from fastapi import FastAPI, Response, UploadFile
import uvicorn

app = FastAPI()

class CFGDenoiser(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.inner_model = model

    def forward(self, z, sigma, cond, uncond, text_cfg_scale, image_cfg_scale):
        cfg_z = einops.repeat(z, "1 ... -> n ...", n=3)
        cfg_sigma = einops.repeat(sigma, "1 ... -> n ...", n=3)
        cfg_cond = {
            "c_crossattn": [torch.cat([cond["c_crossattn"][0], uncond["c_crossattn"][0], uncond["c_crossattn"][0]])],
            "c_concat": [torch.cat([cond["c_concat"][0], cond["c_concat"][0], uncond["c_concat"][0]])],
        }
        out_cond, out_img_cond, out_uncond = self.inner_model(cfg_z, cfg_sigma, cond=cfg_cond).chunk(3)
        return out_uncond + text_cfg_scale * (out_cond - out_img_cond) + image_cfg_scale * (out_img_cond - out_uncond)

def load_model_from_config(config, ckpt, vae_ckpt=None, verbose=False):
    print(f"Loading model from {ckpt}")
    pl_sd = torch.load(ckpt, map_location="cpu")
    if "global_step" in pl_sd:
        print(f"Global Step: {pl_sd['global_step']}")
    sd = pl_sd["state_dict"]
    if vae_ckpt is not None:
        print(f"Loading VAE from {vae_ckpt}")
        vae_sd = torch.load(vae_ckpt, map_location="cpu")["state_dict"]
        sd = {
            k: vae_sd[k[len("first_stage_model.") :]] if k.startswith("first_stage_model.") else v
            for k, v in sd.items()
        }
    model = instantiate_from_config(config.model)
    m, u = model.load_state_dict(sd, strict=False)
    if len(m) > 0 and verbose:
        print("missing keys:")
        print(m)
    if len(u) > 0 and verbose:
        print("unexpected keys:")
        print(u)
    return model

model = None
@app.on_event("startup")
def init_model():
    global model
    config = OmegaConf.load("configs/generate.yaml")
    model = load_model_from_config(config, "checkpoints/instruct-pix2pix-00-22000.ckpt", None)

"""
    - REQUIRED PARAMS: image file and edit prompt
    - OPTIONAL PARAMS:
        - Resolution (self-explanatory)
        - Steps (standard stable diffusion param)
        - cfg_text: how strict the image generation should follow prompt (higher = more strict)
        - cfg_image: how much creativity in generation (lower = more edited image, higher = less edited image)
"""
@app.post("/instruct/")
def instruct(edit_prompt: str, image_file: UploadFile, 
    resolution: Optional[int] = 512, steps: Optional[int] = 100, 
    cfg_text: Optional[float] = 7.5,
    cfg_image: Optional[float] = 1.5,
    seed: Optional[int] = None,
):
    model.eval().cuda()
    model_wrap = K.external.CompVisDenoiser(model)
    model_wrap_cfg = CFGDenoiser(model_wrap)
    null_token = model.get_learned_conditioning([""])

    seed = random.randint(0, 100000) if seed is None else seed

    image_bytes = image_file.file.read()

    input_image = Image.open(BytesIO(image_bytes)).convert("RGB")

    width, height = input_image.size
    factor = resolution / max(width, height)
    factor = math.ceil(min(width, height) * factor / 64) * 64 / min(width, height)
    width = int((width * factor) // 64) * 64
    height = int((height * factor) // 64) * 64
    input_image = ImageOps.fit(input_image, (width, height), method=Image.Resampling.LANCZOS)

    with torch.no_grad(), autocast("cuda"), model.ema_scope():
        cond = {}
        cond["c_crossattn"] = [model.get_learned_conditioning([edit_prompt])]
        input_image = 2 * torch.tensor(np.array(input_image)).float() / 255 - 1
        input_image = rearrange(input_image, "h w c -> 1 c h w").to(model.device)
        cond["c_concat"] = [model.encode_first_stage(input_image).mode()]

        uncond = {}
        uncond["c_crossattn"] = [null_token]
        uncond["c_concat"] = [torch.zeros_like(cond["c_concat"][0])]

        sigmas = model_wrap.get_sigmas(steps)

        extra_args = {
            "cond": cond,
            "uncond": uncond,
            "text_cfg_scale": cfg_text,
            "image_cfg_scale": cfg_image,
        }
        torch.manual_seed(seed)
        z = torch.randn_like(cond["c_concat"][0]) * sigmas[0]
        z = K.sampling.sample_euler_ancestral(model_wrap_cfg, z, sigmas, extra_args=extra_args)
        x = model.decode_first_stage(z)
        x = torch.clamp((x + 1.0) / 2.0, min=0.0, max=1.0)
        x = 255.0 * rearrange(x, "1 c h w -> h w c")
        edited_image = Image.fromarray(x.type(torch.uint8).cpu().numpy()).resize((width, height))

    final_image = np.array(edited_image)
    final_image = final_image[:, :, ::-1].copy()
    final_img_bytes = cv2.imencode('.jpg', final_image)[1].tobytes()

    return Response(final_img_bytes, media_type = "image/png")

if __name__ == "__main__":
    uvicorn.run(app, host = "0.0.0.0", port = 4200)