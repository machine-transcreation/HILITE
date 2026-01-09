import streamlit as st
from PIL import Image
import numpy as np
import cv2
from streamlit_js_eval import streamlit_js_eval
from streamlit_drawable_canvas import st_canvas
import base64
import io
import json

st.set_page_config(layout="wide")

@st.cache_resource
def encode_pil_to_base64(pil_image):
    buffered = io.BytesIO()
    pil_image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

@st.cache_resource
def refine_mask(input_dict):
    ref_image_l = input_dict["image"]
    ref_mask_l = input_dict["mask"]

    ref_image_b64 = encode_pil_to_base64(ref_image_l)
    ref_mask_b64 = encode_pil_to_base64(ref_mask_l)

    # Create the JSON payload
    input_json = {
        "input": {
            "mode": "refine_mask",
            "ref_image": ref_image_b64,
            "ref_mask": ref_mask_b64
        }
    }


    input_json = json.dumps(input_json, indent=4)

    return input_json

@st.cache_resource
def run_model(base_dict, ref_dict, strength, ddim_steps, scale, seed, enable_shape_control):
    base_image_l = base_dict["image"]
    base_mask_l = base_dict["mask"]
    ref_image_l = ref_dict["image"]
    ref_mask_l = ref_dict["mask"]

    base_image_b64 = encode_pil_to_base64(base_image_l)
    base_mask_b64 = encode_pil_to_base64(base_mask_l)
    ref_image_b64 = encode_pil_to_base64(ref_image_l)
    ref_mask_b64 = encode_pil_to_base64(ref_mask_l)

    # Create the JSON payload
    input_json = {
        "input": {
            "mode": "run_local",
            "base_image": base_image_b64,
            "base_mask": base_mask_b64,
            "ref_image": ref_image_b64,
            "ref_mask": ref_mask_b64,
            "strength": strength,
            "ddim_steps": ddim_steps,
            "scale": scale,
            "seed": seed,
            "enable_shape_control": enable_shape_control
        }
    }


    input_json = json.dumps(input_json, indent=4)
    
    return input_json

@st.cache_resource
def duplicate_ref_mask_to_background(ref_mask, base_mask):
    ref_mask_array = process_mask(ref_mask.image_data)
    base_mask_array = process_mask(base_mask.image_data)
        
    # Combine masks
    combined_mask = np.maximum(base_mask_array, ref_mask_array)
    
    # Convert back to PIL Image
    return Image.fromarray(combined_mask).convert("RGBA")

# FastAPI endpoints

# Streamlit UI
@st.cache_resource
def prep_img(image, swidth):
    image_pil = Image.open(image).convert("RGB")
    if image_pil.width > (0.4*swidth):
        scale = (0.4*swidth)/image_pil.width
        nheight = int(scale*image_pil.height)
        nwidth = int(scale*image_pil.width)
        image_np = np.asarray(image_pil.convert("RGB"))
        image_mod = cv2.resize(image_np, (nwidth, nheight))
        rgb_image = Image.fromarray(image_mod, 'RGB')
    else:
        rgb_image = image_pil.convert("RGB")
    return rgb_image

@st.cache_resource
def process_mask(mask_data):
    if isinstance(mask_data, np.ndarray):
        # If it's already a numpy array, convert to PIL Image
        mask_image = Image.fromarray(mask_data)
    elif isinstance(mask_data, Image.Image):
        # If it's already a PIL Image, use it directly
        mask_image = mask_data
    else:
        # If it's neither, try to create a PIL Image from it
        try:
            mask_image = Image.fromarray(np.array(mask_data))
        except:
            raise ValueError("Invalid mask data type. Expected numpy array or PIL Image.")

def main():
    st.title("AnyDoor: Teleport your Target Objects!")
    st.write(f"Screen width is {streamlit_js_eval(js_expressions='screen.width', key = 'SCR')}")
    st.write(f"Screen height is {streamlit_js_eval(js_expressions='screen.height', key = 'SCR1')}")
    swidth = streamlit_js_eval(js_expressions='screen.width', key = 'SCR2')
    
    if 'refined_mask' not in st.session_state:
        st.session_state.refined_mask = None
    
    # Output gallery
    output_image = st.empty()

    strength = None
    ddim_steps = None
    scale = None
    seed = None
    enable_shape_control = None
    base_image_pil = None
    base_mask = None
    ref_image_pil = None
    ref_mask = None

    # Advanced options
    with st.expander("Advanced Options"):
        strength = st.slider("Control Strength", 0.0, 2.0, 1.0, 0.01)
        ddim_steps = st.slider("Steps", 1, 100, 30, 1)
        scale = st.slider("Guidance Scale", 0.1, 30.0, 4.5, 0.1)
        seed = st.slider("Seed", -1, 999999999, -1, 1)
        enable_shape_control = st.checkbox("Enable Shape Control", False)
        clone_mask = st.checkbox("Clone Reference Mask to Background", False)

    # Image upload and mask drawing
    col1, col2 = st.columns(2)

    # Reference image and mask
    with col2:
        st.subheader("Reference")
        ref_image = st.file_uploader("Upload reference image", type=["png", "jpg", "jpeg"], label_visibility="hidden")
        if ref_image:
            ref_image_pil = prep_img(ref_image, swidth)
            st.image(ref_image_pil, use_column_width=True)
            
            drawing_mode = st.selectbox("Drawing tool:", ("freedraw", "line", "rect", "circle", "transform", "polygon"), key="ref_drawing_mode")
            stroke_width = st.slider("Stroke width:", 1, 150, 3, key="ref_stroke_width")
            stroke_color = st.color_picker("Stroke color:", "#B5B5B5", key="ref_stroke_color")
            
            # Use the refined mask from session state if available
            initial_drawing = None
            if st.session_state.refined_mask is not None:
                initial_drawing = {
                    "version": "4.4.0",
                    "objects": [
                        {
                            "type": "image",
                            "version": "4.4.0",
                            "originX": "left",
                            "originY": "top",
                            "left": 0,
                            "top": 0,
                            "width": ref_image_pil.width,
                            "height": ref_image_pil.height,
                            "fill": "rgb(0,0,0)",
                            "stroke": None,
                            "strokeWidth": 0,
                            "strokeDashArray": None,
                            "strokeLineCap": "butt",
                            "strokeDashOffset": 0,
                            "strokeLineJoin": "miter",
                            "strokeUniform": False,
                            "strokeMiterLimit": 4,
                            "scaleX": 1,
                            "scaleY": 1,
                            "angle": 0,
                            "flipX": False,
                            "flipY": False,
                            "opacity": 1,
                            "shadow": None,
                            "visible": True,
                            "backgroundColor": "",
                            "fillRule": "nonzero",
                            "paintFirst": "fill",
                            "globalCompositeOperation": "source-over",
                            "skewX": 0,
                            "skewY": 0,
                            "cropX": 0,
                            "cropY": 0,
                            "src": f"data:image/png;base64,{base64.b64encode(cv2.imencode('.png', st.session_state.refined_mask.copy())[1]).decode()}",
                            "crossOrigin": None,
                            "filters": []
                        }
                    ]
                }
            
            ref_mask = st_canvas(
                fill_color="rgba(181, 181, 181, 0.8)",
                stroke_width=stroke_width,
                stroke_color=f"{stroke_color}80",
                background_image=ref_image_pil,
                height=ref_image_pil.height,
                width=ref_image_pil.width,
                initial_drawing=initial_drawing,
                drawing_mode=drawing_mode,
                key="ref_canvas",
            )

            if st.button("Refine Mask"):
                if ref_mask.image_data is not None and ref_image_pil is not None:
                    refined_mask = refine_mask({"image": ref_image_pil, "mask": Image.fromarray(ref_mask.image_data)})
                    st.session_state.refined_mask = refined_mask
                    st.rerun()

    # Background image and mask
    with col1:
        st.subheader("Background")
        base_image = st.file_uploader("Upload background image", type=["png", "jpg", "jpeg"], label_visibility="hidden")
        if base_image:
            base_image_pil = prep_img(base_image, swidth)
            st.image(base_image_pil, use_column_width=True)
            
            drawing_mode = st.selectbox("Drawing tool:", ("freedraw", "line", "rect", "circle", "transform", "polygon"), key="base_drawing_mode")
            stroke_width = st.slider("Stroke width:", 1, 150, 3, key="base_stroke_width")
            stroke_color = st.color_picker("Stroke color:", "#B5B5B5", key="base_stroke_color")
            
            # If clone_mask is checked and ref_mask exists, use it as initial_drawing
            initial_drawing = None
            if clone_mask and ref_mask is not None and ref_mask.image_data is not None:
                resized_mask = cv2.resize(ref_mask.image_data, (int(0.5*ref_image_pil.width), int(0.5*ref_image_pil.height)), interpolation=cv2.INTER_NEAREST)
                initial_drawing = {
                    "version": "4.4.0",
                    "objects": [
                        {
                            "type": "image",
                            "version": "4.4.0",
                            "originX": "left",
                            "originY": "top",
                            "left": 0,
                            "top": 0,
                            "width": base_image_pil.width,
                            "height": base_image_pil.height,
                            "fill": "rgb(0,0,0)",
                            "stroke": None,
                            "strokeWidth": 0,
                            "strokeDashArray": None,
                            "strokeLineCap": "butt",
                            "strokeDashOffset": 0,
                            "strokeLineJoin": "miter",
                            "strokeUniform": False,
                            "strokeMiterLimit": 4,
                            "scaleX": 1,
                            "scaleY": 1,
                            "angle": 0,
                            "flipX": False,
                            "flipY": False,
                            "opacity": 1,
                            "shadow": None,
                            "visible": True,
                            "backgroundColor": "",
                            "fillRule": "nonzero",
                            "paintFirst": "fill",
                            "globalCompositeOperation": "source-over",
                            "skewX": 0,
                            "skewY": 0,
                            "cropX": 0,
                            "cropY": 0,
                            "src": f"data:image/png;base64,{base64.b64encode(cv2.imencode('.png', resized_mask)[1]).decode()}",
                            "crossOrigin": None,
                            "filters": []
                        }
                    ]
                }
            
            base_mask = st_canvas(
                fill_color="rgba(181, 181, 181, 0.8)",
                stroke_width=stroke_width,
                stroke_color=f"{stroke_color}80",
                background_image=base_image_pil,
                height=base_image_pil.height,
                width=base_image_pil.width,
                drawing_mode=drawing_mode,
                key="base_canvas",
                initial_drawing=initial_drawing
            )


    if st.button("Generate"):
        if base_image_pil and base_mask and ref_image_pil and ref_mask:
            result = run_model({"image": base_image_pil, "mask": Image.fromarray(base_mask.image_data)},
                       {"image": ref_image_pil, "mask": Image.fromarray(ref_mask.image_data)},
                       strength, ddim_steps, scale, seed, enable_shape_control)
            result = Image.fromarray(result[0])
            output_image.image(result)
        else:
            st.warning("Please upload all required images and draw masks.")
        
main()