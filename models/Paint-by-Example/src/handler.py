import argparse, os, sys, glob
import cv2
import torch
import numpy as np
from omegaconf import OmegaConf
from PIL import Image
from tqdm import tqdm, trange
from imwatermark import WatermarkEncoder
from itertools import islice
from einops import rearrange
from torchvision.utils import make_grid
import time
from pytorch_lightning import seed_everything
from torch import autocast
from contextlib import contextmanager, nullcontext
import torchvision
from ldm.util import instantiate_from_config
from ldm.models.diffusion.ddim import DDIMSampler
from ldm.models.diffusion.plms import PLMSSampler
from io import BytesIO
from diffusers.pipelines.stable_diffusion.safety_checker import StableDiffusionSafetyChecker
from transformers import AutoFeatureExtractor
from torchvision.transforms import Resize
import runpod
import base64

def get_safety():    
    wm = "Paint-by-Example"
    wm_encoder = WatermarkEncoder()
    wm_encoder.set_watermark('bytes', wm.encode('utf-8'))
    safety_model_id = "CompVis/stable-diffusion-safety-checker"
    safety_feature_extractor = AutoFeatureExtractor.from_pretrained(safety_model_id)
    safety_checker = StableDiffusionSafetyChecker.from_pretrained(safety_model_id)
    return wm, wm_encoder, safety_model_id, safety_feature_extractor, safety_checker

wm, wm_encoder, safety_model_id, safety_feature_extractor, safety_checker = get_safety()


def chunk(it, size):
    it = iter(it)
    return iter(lambda: tuple(islice(it, size)), ())

def get_tensor_clip(normalize=True, toTensor=True):
    transform_list = []
    if toTensor:
        transform_list += [torchvision.transforms.ToTensor()]

    if normalize:
        transform_list += [torchvision.transforms.Normalize((0.48145466, 0.4578275, 0.40821073),
                                                (0.26862954, 0.26130258, 0.27577711))]
    return torchvision.transforms.Compose(transform_list)

def numpy_to_pil(images):
    """
    Convert a numpy image or a batch of images to a PIL image.
    """
    if images.ndim == 3:
        images = images[None, ...]
    images = (images * 255).round().astype("uint8")
    pil_images = [Image.fromarray(image) for image in images]

    return pil_images

def load_model_from_config(_config, ckpt, verbose=False):
    print(f"Loading model from {ckpt}")
    pl_sd = torch.load(ckpt, map_location="cpu")
    if "global_step" in pl_sd:
        print(f"Global Step: {pl_sd['global_step']}")
    sd = pl_sd["state_dict"]
    model = instantiate_from_config(_config.model)
    m, u = model.load_state_dict(sd, strict=False)
    if len(m) > 0 and verbose:
        print("missing keys:")
        print(m)
    if len(u) > 0 and verbose:
        print("unexpected keys:")
        print(u)

    model.cuda()
    model.eval()
    return model

def put_watermark(img, wm_encoder=None):
    if wm_encoder is not None:
        img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        img = wm_encoder.encode(img, 'dwtDct')
        img = Image.fromarray(img[:, :, ::-1])
    return img

def load_replacement(x):
    try:
        hwc = x.shape
        y = Image.open("assets/rick.jpeg").convert("RGB").resize((hwc[1], hwc[0]))
        y = (np.array(y)/255.0).astype(x.dtype)
        assert y.shape == x.shape
        return y
    except Exception:
        return x

def check_safety(x_image):
    safety_checker_input = safety_feature_extractor(numpy_to_pil(x_image), return_tensors="pt")
    x_checked_image, has_nsfw_concept = safety_checker(images=x_image, clip_input=safety_checker_input.pixel_values)
    assert x_checked_image.shape[0] == len(has_nsfw_concept)
    for i in range(len(has_nsfw_concept)):
        if has_nsfw_concept[i]:
            x_checked_image[i] = load_replacement(x_checked_image[i])
    return x_checked_image, has_nsfw_concept

def get_tensor(normalize=True, toTensor=True):
    transform_list = []
    if toTensor:
        transform_list += [torchvision.transforms.ToTensor()]

    if normalize:
        transform_list += [torchvision.transforms.Normalize((0.5, 0.5, 0.5),
                                                (0.5, 0.5, 0.5))]
    return torchvision.transforms.Compose(transform_list)

def get_tensor_clip(normalize=True, toTensor=True):
    transform_list = []
    if toTensor:
        transform_list += [torchvision.transforms.ToTensor()]

    if normalize:
        transform_list += [torchvision.transforms.Normalize((0.48145466, 0.4578275, 0.40821073),
                                                (0.26862954, 0.26130258, 0.27577711))]
    return torchvision.transforms.Compose(transform_list)

def get_models ():
    seed_everything(321)

    config = OmegaConf.load("/configs/v1.yaml")
    model = load_model_from_config(config, "/checkpoints/model.ckpt")

    device = torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")
    model = model.to(device)

    sampler = PLMSSampler(model) 

    return config, model, sampler, device

config, model, sampler, device = get_models()

def run_local(
    input_image: Image.Image,
    mask_image: Image.Image,
    reference_image: Image.Image,
    ddim_steps: int = 50,
    fixed_code: bool = False,
    ddim_eta: float = 0.0,
    n_samples: int = 1,
    scale: float = 5,
    precision: str = "autocast",
    C: int = 4,
    f: int = 8,
    W: int = 512,
    H: int = 512,
    n_rows: int = 0
):
    global config, model, sampler, device 

    input_image = input_image.resize((512, 512))
    mask_image = mask_image.resize((512, 512))

    batch_size = n_samples
    n_rows = n_rows if n_rows > 0 else batch_size

    start_code = None
    if fixed_code:
        start_code = torch.randn([n_samples, C, H // f, W // f], device=device)

    precision_scope = autocast if precision=="autocast" else nullcontext
    with torch.no_grad():
        with precision_scope("cuda"):
            with model.ema_scope():
                img_p = input_image.convert("RGB")
                image_tensor = get_tensor()(img_p)
                image_tensor = image_tensor.unsqueeze(0)
                ref_p = reference_image.convert("RGB").resize((224,224))
                ref_tensor=get_tensor_clip()(ref_p)
                ref_tensor = ref_tensor.unsqueeze(0)
                mask= mask_image.convert("L")
                mask = np.array(mask)[None,None]
                mask = 1 - mask.astype(np.float32)/255.0
                mask[mask < 0.5] = 0
                mask[mask >= 0.5] = 1
                mask_tensor = torch.from_numpy(mask)
                inpaint_image = image_tensor*mask_tensor
                test_model_kwargs={}
                test_model_kwargs['inpaint_mask']=mask_tensor.to(device)
                test_model_kwargs['inpaint_image']=inpaint_image.to(device)
                ref_tensor=ref_tensor.to(device)
                uc = None
                if scale != 1.0:
                    uc = model.learnable_vector
                c = model.get_learned_conditioning(ref_tensor.to(torch.float16))
                c = model.proj_out(c)
                inpaint_mask=test_model_kwargs['inpaint_mask']
                z_inpaint = model.encode_first_stage(test_model_kwargs['inpaint_image'])
                z_inpaint = model.get_first_stage_encoding(z_inpaint).detach()
                test_model_kwargs['inpaint_image']=z_inpaint
                test_model_kwargs['inpaint_mask']=Resize([z_inpaint.shape[-2],z_inpaint.shape[-1]])(test_model_kwargs['inpaint_mask'])

                shape = [C, H // f, W // f]
                samples_ddim, _ = sampler.sample(S=ddim_steps,
                                                    conditioning=c,
                                                    batch_size=n_samples,
                                                    shape=shape,
                                                    verbose=False,
                                                    unconditional_guidance_scale=scale,
                                                    unconditional_conditioning=uc,
                                                    eta=ddim_eta,
                                                    x_T=start_code,
                                                    test_model_kwargs=test_model_kwargs)

                x_samples_ddim = model.decode_first_stage(samples_ddim)
                x_samples_ddim = torch.clamp((x_samples_ddim + 1.0) / 2.0, min=0.0, max=1.0)
                x_samples_ddim = x_samples_ddim.cpu().permute(0, 2, 3, 1).numpy()

                x_checked_image, has_nsfw_concept = check_safety(x_samples_ddim)
                x_checked_image=x_samples_ddim
                x_checked_image_torch = torch.from_numpy(x_checked_image).permute(0, 3, 1, 2)

                def un_norm(x):
                    return (x+1.0)/2.0
                def un_norm_clip(x):
                    x[0,:,:] = x[0,:,:] * 0.26862954 + 0.48145466
                    x[1,:,:] = x[1,:,:] * 0.26130258 + 0.4578275
                    x[2,:,:] = x[2,:,:] * 0.27577711 + 0.40821073
                    return x

                for i,x_sample in enumerate(x_checked_image_torch):
                    all_img=[]
                    all_img.append(un_norm(image_tensor[i]).cpu())
                    all_img.append(un_norm(inpaint_image[i]).cpu())
                    ref_img=ref_tensor
                    ref_img=Resize([H, W])(ref_img)
                    all_img.append(un_norm_clip(ref_img[i]).cpu())
                    all_img.append(x_sample)
                    grid = torch.stack(all_img, 0)
                    grid = make_grid(grid)
                    grid = 255. * rearrange(grid, 'c h w -> h w c').cpu().numpy()
                    grid_img = Image.fromarray(grid.astype(np.uint8))

                    x_sample = 255. * rearrange(x_sample.cpu().numpy(), 'c h w -> h w c')
                    result_img = Image.fromarray(x_sample.astype(np.uint8))
                    
    return result_img, grid_img

def decode_base64_image(base64_string):
    img_data = base64.b64decode(base64_string)
    return Image.open(BytesIO(img_data))

def encode_pil_to_base64(pil_image):
    buffered = BytesIO()
    pil_image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

def handler(job):
    job_input = job["input"]

    base_image = decode_base64_image(job_input["base_image"])
    base_mask = decode_base64_image(job_input["base_mask"])
    ref_image = decode_base64_image(job_input["ref_image"])
    
    ddim_steps = job_input.get("ddim_steps", 50)
    scale = job_input.get("scale", 7.5)

    result, _ = run_local(base_image, base_mask, ref_image, ddim_steps=ddim_steps, scale=scale)

    result_b64 = encode_pil_to_base64(result)
    
    return {"image": result_b64}
            
if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})    

    # img = Image.open("/home/azureuser/image-transcreation/Paint_by_Example/Paint-by-Example/examples/image/example_1.png")
    # print(np.array(img).shape) # (512, 512, 3)

    # mask = Image.open("/home/azureuser/image-transcreation/Paint_by_Example/Paint-by-Example/examples/mask/example_1.png")
    # print(np.array(mask).shape, np.array(mask)) # (512, 512)

    # reference = Image.open("/home/azureuser/image-transcreation/Paint_by_Example/Paint-by-Example/examples/reference/example_1.jpg")
    # print(np.array(reference).shape) # (1277, 1920, 3)

    # result, grid = run_local(
    #     img, 
    #     mask,
    #     reference
    # )
    # result.save("./result.png")
    # grid.save("./grid.png")

    # run_st()