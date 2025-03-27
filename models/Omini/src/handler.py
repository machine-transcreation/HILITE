import os
import io
import base64
import requests
import torch
from PIL import Image
from datetime import datetime

# Import the FLUX pipeline and OminiControl modules
from diffusers.pipelines.flux.pipeline_flux import FluxPipeline
from diffusers import AutoencoderKL, FlowMatchEulerDiscreteScheduler
from diffusers.models.transformers.transformer_flux import FluxTransformer2DModel
from transformers import CLIPTextModel, CLIPTokenizer, T5EncoderModel, T5TokenizerFast

from src.flux.condition import Condition  # OminiControl Condition class
from src.flux.generate import generate    # OminiControl generate function
import runpod

# Load base FLUX model pipeline
pipe = FluxPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-schnell", torch_dtype=torch.bfloat16
)
pipe = pipe.to("cuda")  # Move model to GPU for inference

# Load OminiControl LoRA weights for subject-driven generation
pipe.load_lora_weights(
    "Yuanshi/OminiControl",
    weight_name="omini/subject_512.safetensors",
    adapter_name="subject",  # name the adapter "subject" for default use
)

@torch.inference_mode()
def handler(event):
    """Runpod handler function for subject-driven image editing."""
    # Extract input fields
    inputs = event.get("input", {})  # Runpod passes data under "input"
    image_input = inputs.get("image")  # URL, base64, or local path
    prompt = inputs.get("prompt")
    resolution = inputs.get("resolution", 512)  # default 512

    if image_input is None or prompt is None:
        return {"error": "Missing 'image' or 'prompt' in input."}
    
    # Load the input image (supports URL, base64, and local file paths)
    try:
        if isinstance(image_input, str):
            if image_input.startswith(("http://", "https://")):
                # Load from URL
                resp = requests.get(image_input)
                resp.raise_for_status()
                image = Image.open(io.BytesIO(resp.content))

            elif os.path.exists(image_input):
                # Load from local file
                image = Image.open(image_input)

            else:
                # Assume base64 input
                image_data = image_input.split("base64,")[-1] if "base64," in image_input else image_input
                image = Image.open(io.BytesIO(base64.b64decode(image_data)))

        else:
            return {"error": "Invalid image format. Must be a URL, base64 string, or local file path."}

    except Exception as e:
        return {"error": f"Failed to load input image: {e}"}
    
    # Preprocess the image: center-crop to square and resize to 512x512
    w, h = image.size
    min_dim = min(w, h)
    left, top = (w - min_dim) // 2, (h - min_dim) // 2
    right, bottom = left + min_dim, top + min_dim
    image = image.crop((left, top, right, bottom))
    image = image.resize((512, 512), Image.Resampling.LANCZOS)
    
    # Create subject condition
    condition = Condition("subject", image)

    # Set resolution
    if resolution and int(resolution) >= 1024:
        pipe.set_adapters("subject_1024")  # Use the 1024px LoRA
        out_height = out_width = 1024
    else:
        pipe.set_adapters("subject")      # Use the default 512px LoRA
        out_height = out_width = 512

    # Generate the image using the OminiControl pipeline
    output = generate(
        pipe,
        prompt=prompt.strip(),
        conditions=[condition],
        num_inference_steps=8,
        height=out_height,
        width=out_width,
    )

    result_image = output.images[0]   # Get the first output image

    # Define output file path
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = f"output_{timestamp}.png"

    # Save the image to file
    result_image.save(output_path, format="PNG")

    # Return the saved file path in response
    return {"output_image_path": output_path}

# Start the Runpod serverless loop with the handler
runpod.serverless.start({"handler": handler})
