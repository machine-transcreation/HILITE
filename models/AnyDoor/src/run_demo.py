import cv2
import einops
import numpy as np
import torch
import random
import os
import uvicorn
import albumentations as A
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import functools

from starlette.requests import Request
from starlette.responses import Response


from redis import asyncio as aioredis

from pydantic import BaseModel
from PIL import Image
import io
from io import BytesIO
import base64

import runpod
from PIL import Image
import torchvision.transforms as T
from datasets.data_utils import * 
from cldm.model import create_model, load_state_dict
from cldm.ddim_hacked import DDIMSampler
from omegaconf import OmegaConf
import functools
from cldm.hack import disable_verbosity, enable_sliced_attention
from iseg.coarse_mask_refine_util import BaselineModel

cv2.setNumThreads(0)
cv2.ocl.setUseOpenCL(False)

save_memory = False
disable_verbosity()
if save_memory:
    enable_sliced_attention()

iseg_model = None
config = None
model_config = None
model_ckpt = None
use_interactive_seg = None
model = None
ddim_sampler = None

def initialize_model():
    global config, model_ckpt, model_config, use_interactive_seg, model, ddim_sampler
    config = OmegaConf.load('./configs/demo.yaml')
    model_ckpt =  config.pretrained_model
    model_config = config.config_file
    use_interactive_seg = config.config_file

    model = create_model(model_config ).cpu()
    model.load_state_dict(load_state_dict(model_ckpt, location='cuda'))
    model = model.cuda()
    ddim_sampler = DDIMSampler(model)

def init_iseg():
    global iseg_model
    model_path = './iseg/coarse_mask_refine.pth'
    iseg_model = BaselineModel().eval()
    weights = torch.load(model_path , map_location='cpu')['state_dict']
    iseg_model.load_state_dict(weights, strict= True)
    return iseg_model

initialize_model()
init_iseg()

    
def process_image_mask(image_np, mask_np):
    global iseg_model
    if iseg_model is None:
        iseg_model = init_iseg()
    img = torch.from_numpy(image_np.transpose((2, 0, 1)))
    img = img.float().div(255).unsqueeze(0)
    mask = torch.from_numpy(mask_np).float().unsqueeze(0).unsqueeze(0)
    pred = iseg_model(img, mask)['instances'][0,0].detach().numpy() > 0.5 
    return pred.astype(np.uint8)

def crop_back( pred, tar_image,  extra_sizes, tar_box_yyxx_crop):
    H1, W1, H2, W2 = extra_sizes
    y1,y2,x1,x2 = tar_box_yyxx_crop    
    pred = cv2.resize(pred, (W2, H2))
    m = 3 # maigin_pixel

    if W1 == H1:
        tar_image[y1+m :y2-m, x1+m:x2-m, :] =  pred[m:-m, m:-m]
        return tar_image

    if W1 < W2:
        pad1 = int((W2 - W1) / 2)
        pad2 = W2 - W1 - pad1
        pred = pred[:,pad1: -pad2, :]
    else:
        pad1 = int((H2 - H1) / 2)
        pad2 = H2 - H1 - pad1
        pred = pred[pad1: -pad2, :, :]
    tar_image[y1+m :y2-m, x1+m:x2-m, :] =  pred[m:-m, m:-m]
    return tar_image

def inference_single_image(ref_image, 
                            ref_mask, 
                            tar_image, 
                            tar_mask, 
                            strength, 
                            ddim_steps, 
                            scale, 
                            seed,
                            enable_shape_control,
                            ):
    raw_background = tar_image.copy()
    item = process_pairs(ref_image, ref_mask, tar_image, tar_mask, enable_shape_control = enable_shape_control)

    ref = item['ref']
    hint = item['hint']
    num_samples = 1

    control = torch.from_numpy(hint.copy()).float().cuda() 
    control = torch.stack([control for _ in range(num_samples)], dim=0)
    control = einops.rearrange(control, 'b h w c -> b c h w').clone()


    clip_input = torch.from_numpy(ref.copy()).float().cuda() 
    clip_input = torch.stack([clip_input for _ in range(num_samples)], dim=0)
    clip_input = einops.rearrange(clip_input, 'b h w c -> b c h w').clone()

    H,W = 512,512

    cond = {"c_concat": [control], "c_crossattn": [model.get_learned_conditioning( clip_input )]}
    un_cond = {"c_concat": [control], 
        "c_crossattn": [model.get_learned_conditioning([torch.zeros((1,3,224,224))] * num_samples)]}
    shape = (4, H // 8, W // 8)

    if save_memory:
        model.low_vram_shift(is_diffusing=True)

    model.control_scales = ([strength] * 13)
    samples, _ = ddim_sampler.sample(ddim_steps, num_samples,
                                        shape, cond, verbose=False, eta=0,
                                        unconditional_guidance_scale=scale,
                                        unconditional_conditioning=un_cond)

    if save_memory:
        model.low_vram_shift(is_diffusing=False)

    x_samples = model.decode_first_stage(samples)
    x_samples = (einops.rearrange(x_samples, 'b c h w -> b h w c') * 127.5 + 127.5).cpu().numpy()

    result = x_samples[0][:,:,::-1]
    result = np.clip(result,0,255)

    pred = x_samples[0]
    pred = np.clip(pred,0,255)[1:,:,:]
    sizes = item['extra_sizes']
    tar_box_yyxx_crop = item['tar_box_yyxx_crop'] 
    tar_image = crop_back(pred, tar_image, sizes, tar_box_yyxx_crop) 

    # keep background unchanged
    y1,y2,x1,x2 = item['tar_box_yyxx']
    raw_background[y1:y2, x1:x2, :] = tar_image[y1:y2, x1:x2, :]
    return raw_background

def process_pairs(ref_image, ref_mask, tar_image, tar_mask, max_ratio = 0.8, enable_shape_control = False):
    # ========= Reference ===========
    # ref expand 
    ref_box_yyxx = get_bbox_from_mask(ref_mask)

    # ref filter mask 
    ref_mask_3 = np.stack([ref_mask,ref_mask,ref_mask],-1)
    masked_ref_image = ref_image * ref_mask_3 + np.ones_like(ref_image) * 255 * (1-ref_mask_3)

    y1,y2,x1,x2 = ref_box_yyxx
    masked_ref_image = masked_ref_image[y1:y2,x1:x2,:]
    ref_mask = ref_mask[y1:y2,x1:x2]

    ratio = np.random.randint(11, 15) / 10 #11,13
    masked_ref_image, ref_mask = expand_image_mask(masked_ref_image, ref_mask, ratio=ratio)
    ref_mask_3 = np.stack([ref_mask,ref_mask,ref_mask],-1)

    # to square and resize
    masked_ref_image = pad_to_square(masked_ref_image, pad_value = 255, random = False)
    masked_ref_image = cv2.resize(masked_ref_image.astype(np.uint8), (224,224) ).astype(np.uint8)

    ref_mask_3 = pad_to_square(ref_mask_3 * 255, pad_value = 0, random = False)
    ref_mask_3 = cv2.resize(ref_mask_3.astype(np.uint8), (224,224) ).astype(np.uint8)
    ref_mask = ref_mask_3[:,:,0]

    # collage aug 
    masked_ref_image_compose, ref_mask_compose =  masked_ref_image, ref_mask
    ref_mask_3 = np.stack([ref_mask_compose,ref_mask_compose,ref_mask_compose],-1)
    ref_image_collage = sobel(masked_ref_image_compose, ref_mask_compose/255)

    # ========= Target ===========
    tar_box_yyxx = get_bbox_from_mask(tar_mask)
    tar_box_yyxx = expand_bbox(tar_mask, tar_box_yyxx, ratio=[1.1,1.2]) #1.1  1.3
    tar_box_yyxx_full = tar_box_yyxx
        
    # crop
    tar_box_yyxx_crop =  expand_bbox(tar_image, tar_box_yyxx, ratio=[1.3, 3.0])   
    tar_box_yyxx_crop = box2squre(tar_image, tar_box_yyxx_crop) # crop box
    y1,y2,x1,x2 = tar_box_yyxx_crop

    cropped_target_image = tar_image[y1:y2,x1:x2,:]
    cropped_tar_mask = tar_mask[y1:y2,x1:x2]

    tar_box_yyxx = box_in_box(tar_box_yyxx, tar_box_yyxx_crop)
    y1,y2,x1,x2 = tar_box_yyxx

    # collage
    ref_image_collage = cv2.resize(ref_image_collage.astype(np.uint8), (x2-x1, y2-y1))
    ref_mask_compose = cv2.resize(ref_mask_compose.astype(np.uint8), (x2-x1, y2-y1))
    ref_mask_compose = (ref_mask_compose > 128).astype(np.uint8)

    collage = cropped_target_image.copy() 
    collage[y1:y2,x1:x2,:] = ref_image_collage

    collage_mask = cropped_target_image.copy() * 0.0
    collage_mask[y1:y2,x1:x2,:] = 1.0
    if enable_shape_control:
        collage_mask = np.stack([cropped_tar_mask,cropped_tar_mask,cropped_tar_mask],-1)

    # the size before pad
    H1, W1 = collage.shape[0], collage.shape[1]

    cropped_target_image = pad_to_square(cropped_target_image, pad_value = 0, random = False).astype(np.uint8)
    collage = pad_to_square(collage, pad_value = 0, random = False).astype(np.uint8)
    collage_mask = pad_to_square(collage_mask, pad_value = 2, random = False).astype(np.uint8)

    # the size after pad
    H2, W2 = collage.shape[0], collage.shape[1]

    cropped_target_image = cv2.resize(cropped_target_image.astype(np.uint8), (512,512)).astype(np.float32)
    collage = cv2.resize(collage.astype(np.uint8), (512,512)).astype(np.float32)
    collage_mask  = cv2.resize(collage_mask.astype(np.uint8), (512,512),  interpolation = cv2.INTER_NEAREST).astype(np.float32)
    collage_mask[collage_mask == 2] = -1

    masked_ref_image = masked_ref_image  / 255 
    cropped_target_image = cropped_target_image / 127.5 - 1.0
    collage = collage / 127.5 - 1.0 
    collage = np.concatenate([collage, collage_mask[:,:,:1]  ] , -1)
        
    item = dict(ref=masked_ref_image.copy(), jpg=cropped_target_image.copy(), hint=collage.copy(), 
                extra_sizes=np.array([H1, W1, H2, W2]), 
                tar_box_yyxx_crop=np.array( tar_box_yyxx_crop ),
                tar_box_yyxx=np.array(tar_box_yyxx_full),
                ) 
    return item



def mask_image(image, mask):
    blanc = np.ones_like(image) * 255
    mask = np.stack([mask,mask,mask],-1) / 255
    masked_image = mask * ( 0.5 * blanc + 0.5 * image) + (1-mask) * image
    return masked_image.astype(np.uint8)


def run_local(base, ref, strength, ddim_steps, scale, seed, enable_shape_control):
    image = base["image"].convert("RGB")
    mask = base["mask"].convert("L")
    ref_image = ref["image"].convert("RGB")
    ref_mask = ref["mask"].convert("L")
    image = np.asarray(image)
    mask = np.asarray(mask)
    mask = np.where(mask > 128, 1, 0).astype(np.uint8)
    ref_image = np.asarray(ref_image)
    ref_mask = np.asarray(ref_mask)
    ref_mask = np.where(ref_mask > 128, 1, 0).astype(np.uint8)
    ref_mask = process_image_mask(ref_image, ref_mask)

    synthesis = inference_single_image(ref_image.copy(), ref_mask.copy(), image.copy(), mask.copy(), 
                                        strength, ddim_steps, scale, seed, enable_shape_control)
    synthesis = torch.from_numpy(synthesis).permute(2, 0, 1)
    synthesis = synthesis.permute(1, 2, 0).numpy()
    return [synthesis]

def decode_base64_image(base64_string):
    img_data = base64.b64decode(base64_string)
    return Image.open(BytesIO(img_data))

def encode_pil_to_base64(pil_image):
    buffered = BytesIO()
    pil_image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

def handler(job):
    job_input = job["input"]
    mode = job_input.get("mode", "run_local")

    if mode == "run_local":
        base_image = decode_base64_image(job_input["base_image"])
        base_mask = decode_base64_image(job_input["base_mask"])
        ref_image = decode_base64_image(job_input["ref_image"])
        ref_mask = decode_base64_image(job_input["ref_mask"])
        
        strength = job_input.get("strength", 1.0)
        ddim_steps = job_input.get("ddim_steps", 50)
        scale = job_input.get("scale", 7.5)
        seed = job_input.get("seed", 42)
        enable_shape_control = job_input.get("enable_shape_control", False)

        result = run_local(
            {"image": base_image, "mask": base_mask},
            {"image": ref_image, "mask": ref_mask},
            strength, ddim_steps, scale, seed, enable_shape_control
        )

        result_image = Image.fromarray(result[0])
        result_b64 = encode_pil_to_base64(result_image)
        
        return {"image": result_b64}

    elif mode == "refine_mask":
        ref_image = decode_base64_image(job_input["ref_image"])
        ref_mask = decode_base64_image(job_input["ref_mask"])

        ref_image_np = np.array(ref_image)
        ref_mask_np = np.array(ref_mask.convert("L"))
        ref_mask_np = np.where(ref_mask_np > 128, 1, 0).astype(np.uint8)

        refined_ref_mask = process_image_mask(ref_image_np, ref_mask_np)
        
        refined_ref_mask_rgba = np.zeros((refined_ref_mask.shape[0], refined_ref_mask.shape[1], 4), dtype=np.uint8)
        refined_ref_mask_rgba[..., 3] = refined_ref_mask * 204  # Alpha channel at 80% opacity
        refined_ref_mask_rgba[..., 0:3] = np.where(refined_ref_mask[..., None], 181, 0)
        
        refined_ref_mask_pil = Image.fromarray(refined_ref_mask_rgba, mode="RGBA")
        refined_mask_b64 = encode_pil_to_base64(refined_ref_mask_pil)
        
        return {"refined_mask": refined_mask_b64}

    else:
        return {"error": "Invalid mode specified"}

runpod.serverless.start({"handler": handler})


# import torch
# from PIL import Image
# import cv2
# import numpy as np
# import io
# import base64
# from fastapi import FastAPI, File, UploadFile, Form
# from pydantic import BaseModel
# from diffusers import (
#     StableDiffusionControlNetPipeline,
#     ControlNetModel,
#     UniPCMultistepScheduler,
# )

# app = FastAPI()


# device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# class ModelInfo(BaseModel):
#     control_type: str
#     model_path: str
#     scheduler_config: dict

# def get_canny_image(image, low_threshold, high_threshold):
#     image_array = np.array(image)
#     canny_image = cv2.Canny(image_array, low_threshold, high_threshold)
#     canny_image = canny_image[:, :, None]
#     canny_image = np.concatenate([canny_image, canny_image, canny_image], axis=2)
#     return Image.fromarray(canny_image)

# def compress_image(image, max_size):
#     width, height = image.size
#     if width > height:
#         if width > max_size:
#             height = int(max_size * height / width)
#             width = max_size
#     else:
#         if height > max_size:
#             width = int(max_size * width / height)
#             height = max_size
#     resized_image = image.resize((width, height))
#     return resized_image

# def load_model(control_type, use_cpu=False):
#     try:
#         torch_dtype = torch.float32 if use_cpu else torch.float16
#         device = "cpu" if use_cpu else "cuda"
        
#         controlnet = ControlNetModel.from_pretrained(
#             f"lllyasviel/sd-controlnet-{control_type}",
#             torch_dtype=torch_dtype
#         )
#         pipe = StableDiffusionControlNetPipeline.from_pretrained(
#             "runwayml/stable-diffusion-v1-5",
#             controlnet=controlnet,
#             torch_dtype=torch_dtype,
#             safety_checker=None,
#             revision="fp16" if not use_cpu else "main"
#         )
#         pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config)
        
#         if not use_cpu:
#             pipe.enable_model_cpu_offload()
#             if torch.cuda.is_available():
#                 pipe.enable_xformers_memory_efficient_attention()
#         else:
#             pipe = pipe.to("cpu")
        
#         return pipe
#     except Exception as e:
#         return None
    
# @app.post("/generate")
# async def generate_image(
#     control_type: str = Form(...),
#     prompt: str = Form(...),
#     image: UploadFile = File(...),
#     low_threshold: int = Form(100),
#     high_threshold: int = Form(200),
# ):
#     try:
#         contents = await image.read()
#         input_image = Image.open(io.BytesIO(contents))
#         input_image = compress_image(input_image, 512) 
        

#         if control_type == "canny":
#             control_image = get_canny_image(input_image, low_threshold, high_threshold)
#         else:
#             control_image = input_image

#         pipe = load_model(control_type)
        
#         with torch.inference_mode():
#             output_image = pipe(
#                 prompt,
#                 image=control_image,
#                 num_inference_steps=20,
#                 guidance_scale=7.5,
#             ).images[0]
        
#         buffered = io.BytesIO()
#         output_image.save(buffered, format="PNG")
#         img_str = base64.b64encode(buffered.getvalue()).decode()
        
#         return {"image": img_str}
    
#     except Exception as e:
#         return {"error": str(e)}

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=5400)