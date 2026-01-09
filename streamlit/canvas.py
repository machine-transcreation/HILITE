import streamlit as st
import numpy as np
from streamlit_drawable_canvas import st_canvas
from PIL import Image
import matplotlib.pyplot as plt
import cv2
import base64
from io import BytesIO
import os 
from dotenv import load_dotenv
import requests
import json
from pymongo import MongoClient
from pymongo.server_api import ServerApi

@st.cache_data
def load_runpod_info():
    load_dotenv("./.env")
    
    url = os.getenv("SAM2_ENDPOINT")
    key = os.getenv("RUNPOD_KEY")

    return url, key

@st.cache_resource
def load_db_connection():
    load_dotenv("./.env")
    
    uri = os.getenv("MONGODB")
    client = MongoClient(uri, server_api = ServerApi('1'))

    return client

def scale_point(point, from_size, to_size):
    return (
        int(point[0] * to_size[0] / from_size[0]),
        int(point[1] * to_size[1] / from_size[1])
    )

def create_colored_mask_image(mask, R, G, B, A):
    R, G, B, A = map(lambda x: max(0, min(255, x)), [R, G, B, A])
    
    if mask.ndim > 2:
        mask = mask[0]

    mask = (mask > 0).astype(np.uint8)
    height, width = mask.shape
    rgba_image = np.zeros((height, width, 4), dtype=np.uint8)

    rgba_image[mask == 1] = [R, G, B, A]
    image = Image.fromarray(rgba_image, 'RGBA')
    
    return image

def image_to_base64(image: Image) -> str:
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode()

def load_image_from_base64(base64_str: str) -> Image.Image:
    image_bytes = base64.b64decode(base64_str)
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    return image

endpoint_url, key = load_runpod_info()
db_client = load_db_connection()

def SAM2(image: Image, points: np.array, labels: np.array, rgba: tuple):
    image_b64 = image_to_base64(image)

    points = points.tolist()
    labels = labels.tolist()

    url = endpoint_url

    headers = {
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json'
    }

    input_dict = {
        "input": {
            "image": image_b64,
            "points": points,
            "labels": labels,
            "R": 50,
            "G": 50,
            "B": 50,
            "A": 255
        }
    }

    payload = json.dumps(input_dict)

    response = requests.post(
        url = url,
        headers = headers,
        data = payload
    )

    mask_b64 = json.loads(response.text)["output"]["mask"]

    return load_image_from_base64(mask_b64)

def overlay(image, mask, borders=True):
    image_np = np.array(image)
    mask_np = np.array(mask.convert('L'))  

    h, w = image_np.shape[:2]
    mask_np = cv2.resize(mask_np, (w, h))

    color = np.array([50 / 255, 50 / 255, 50 / 255, 1])  

    mask_image = mask_np.reshape(h, w, 1) / 255.0 * color.reshape(1, 1, -1)

    if borders:
        contours, _ = cv2.findContours(mask_np, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        contours = [cv2.approxPolyDP(contour, epsilon=0.01, closed=True) for contour in contours]
        mask_image = cv2.drawContours(mask_image, contours, -1, (1, 1, 1, 0.5), thickness=2)

    plt.figure(figsize=(10, 10))
    plt.imshow(image_np)
    plt.imshow(mask_image, alpha=0.6)
    plt.axis('off')

    buf = BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0)
    buf.seek(0)

    pil_image = Image.open(buf)
    buf.seek(0) 
    plt.close()

    return pil_image

def process_image(prefix):
    if f"{prefix}_image" in st.session_state:
        original_image = st.session_state[f"{prefix}_original_image"]
        resized_image = st.session_state[f"{prefix}_image"]
        width, height = 256, 256
        
        st.write(f"Draw points on the {prefix} image:")
        
        draw_mode = st.radio(f"Select the point type for {prefix}:", ("Green +", "Red -"), key=f"{prefix}_draw_mode")
        stroke_color = "#00FF00" if draw_mode == "Green +" else "#FF0000"

        if f"{prefix}_green_points" not in st.session_state:
            st.session_state[f"{prefix}_green_points"] = []
        if f"{prefix}_red_points" not in st.session_state:
            st.session_state[f"{prefix}_red_points"] = []

        canvas_result = st_canvas(
            fill_color="rgba(0, 0, 0, 0)",  
            stroke_width=3,
            stroke_color=stroke_color,
            background_image=resized_image,
            update_streamlit=True,
            height=height,
            width=width,
            drawing_mode="circle", 
            key=f"{prefix}_canvas",
        )

        if canvas_result.json_data is not None:
            current_green_points = []
            current_red_points = []

            for obj in canvas_result.json_data["objects"]:
                
                point = (obj["left"] + obj["radius"], obj["top"] + obj["radius"])
                if obj["stroke"] == "#00FF00":
                    current_green_points.append(point)
                elif obj["stroke"] == "#FF0000":  
                    current_red_points.append(point)

            st.session_state[f"{prefix}_green_points"] = current_green_points
            st.session_state[f"{prefix}_red_points"] = current_red_points

        if st.button(f"Create Mask for {prefix.capitalize()} Image"):
            create_mask(prefix)

        if f"{prefix}_mask" in st.session_state:
            mask_overlay = create_mask_overlay(resized_image, st.session_state[f"{prefix}_mask"])
            st.image(mask_overlay, caption=f"{prefix.capitalize()} Image with Transparent Mask")
            
            st.session_state[f"{prefix}_mask_created"] = True

def create_mask(prefix):
    original_image = st.session_state[f"{prefix}_original_image"]
    resized_image = st.session_state[f"{prefix}_image"]
    
    original_size = original_image.size
    new_size = (512, 512)  
    display_size = resized_image.size  

    green_points = [scale_point(p, display_size, new_size) for p in st.session_state[f"{prefix}_green_points"]]
    red_points = [scale_point(p, display_size, new_size) for p in st.session_state[f"{prefix}_red_points"]]

    sam_points = green_points + red_points
    sam_labels = [1] * len(green_points) + [0] * len(red_points)

    sam2_input_image = original_image.resize(new_size)

    with st.spinner(f"Generating mask for {prefix} image"):
        mask = SAM2(image=sam2_input_image, points=np.array(sam_points), labels=np.array(sam_labels), rgba=(50, 50, 50, 255))
    
    st.session_state[f"{prefix}_mask"] = mask.resize(display_size)

def submit_mask_data(base_url, reference_url, email):
    backend_url = os.getenv("BACKEND_URL")
    
    if "base_updated_mask" in st.session_state and "reference_updated_mask" in st.session_state:
        base_arr = (st.session_state["base_updated_mask"] * 255).astype(np.uint8)
        ref_arr = (st.session_state["reference_updated_mask"] * 255).astype(np.uint8)

        base_arr = (base_arr > 0).astype(np.uint8) * 255
        ref_arr = (ref_arr > 0).astype(np.uint8) * 255

        base_mask = Image.fromarray(base_arr).convert("L").resize(st.session_state.base_original_size)
        ref_mask = Image.fromarray(ref_arr).convert("L").resize(st.session_state.reference_original_size)

        buffered_base = BytesIO()
        base_mask.save(buffered_base, format="PNG", optimize=True)
        base64_base = base64.b64encode(buffered_base.getvalue()).decode("utf-8")

        buffered_ref = BytesIO()
        ref_mask.save(buffered_ref, format="PNG", optimize=True)
        base64_ref = base64.b64encode(buffered_ref.getvalue()).decode("utf-8")

        db_data_submit = {
            "base_image": base_url,
            "reference_image": reference_url,
            "base_mask": base64_base,
            "reference_mask": base64_ref,
            "email": email
        }

        try:
            collection = db_client["OpenNLP"]["uploads"]
            collection.insert_one(db_data_submit)

            st.success("Mask data submitted successfully!")

        except Exception as e:
            st.error(f"An error occurred while submitting the mask data: {str(e)}")
         
        if not backend_url:
            st.error("Backend URL is not set. Please check your environment variables.")
            return

        try:
            response = requests.post(
                backend_url, 
                json={
                    "base_image": base_url,
                    "reference_image": reference_url,
                    "base_mask": base64_base,
                    "reference_mask": base64_ref,
                    "email": email
                },
                headers={'Content-Type': 'application/json'}
            )

            if response.status_code == 200:
                st.success("Mask data submitted successfully!")
            else:
                st.error(f"Failed to submit mask data. Status code: {response.status_code}")
                st.error(f"Response content: {response.text}")
        except requests.exceptions.RequestException as e:
            st.error(f"An error occurred while submitting the mask data: {str(e)}")
    else:
        st.error("Please create masks for both images before submitting.")


def create_mask_overlay(image, mask, opacity=0.8):
    mask_np = np.array(mask.convert('L'))
    mask_np = cv2.resize(mask_np, (256, 256))

    mask_color = [128, 128, 128, int(255 * opacity)]
    mask_overlay = np.zeros((256, 256, 4), dtype=np.uint8)
    mask_overlay[mask_np > 0] = mask_color

    return Image.fromarray(mask_overlay, 'RGBA')

def process_image_drawing(prefix, column, show_mask=True, clone_mask=False):
    if f"{prefix}_canvas_data" not in st.session_state:
        st.session_state[f"{prefix}_canvas_data"] = {
            "version": "4.4.0",
            "objects": []
        }
    image = st.session_state[f"{prefix}_image"]
    mask = st.session_state.get(f"{prefix}_mask")
    
    width, height = 256, 256
    
    with column:
        st.write(f"Draw on the {prefix} image:")
        
        drawing_mode = st.selectbox(
            "Drawing tool:",
            ("freedraw", "line", "rect", "circle", "transform"),
            key = f'{prefix}_select_box'
        )

        stroke_width = st.slider("Stroke width:", 1, 150, 75, key=f"{prefix}_stroke_width")
        
        
        alpha = int(80 * 2.55)
        
        stroke_color = f"rgba({128},{128},{128},{60/100})"

        initial_drawing = {"version": "4.4.0", "objects": []}

        if show_mask and mask is not None and st.session_state.use_sam2:
            mask_overlay = create_mask_overlay(image, mask, opacity=0.8)
            mask_b64 = image_to_base64(mask_overlay)
            initial_drawing["objects"].append(create_image_object(width, height, mask_b64))

        if clone_mask and "reference_canvas_data" in st.session_state:
            ref_canvas_data = st.session_state["reference_canvas_data"]
            initial_drawing["objects"].extend(ref_canvas_data.get("objects", []))

        canvas_result = st_canvas(
            fill_color="rgba(0, 0, 0, 0)",  
            stroke_width=stroke_width,
            stroke_color=stroke_color,
            background_image=image,
            update_streamlit=True,
            height=height,
            width=width,
            drawing_mode=drawing_mode,
            key=f"{prefix}_canvas",
            initial_drawing=initial_drawing
        )
        
        if canvas_result.image_data is not None:
            st.session_state[f"{prefix}_updated_mask"] = canvas_result.image_data[:,:,3]
        
        st.session_state[f"{prefix}_canvas_data"] = canvas_result.json_data

      
            
def create_image_object(width, height, image_b64):
    return {
        "type": "image",
        "version": "4.4.0",
        "originX": "left",
        "originY": "top",
        "left": 0,
        "top": 0,
        "width": width,
        "height": height,
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
        "src": f"data:image/png;base64,{image_b64}",
        "crossOrigin": None,
        "filters": []
    }

def show_instructions_button(mode):
    with st.expander("Click here for instructions"):
        if mode == "Point":
            st.markdown("""
            ### How to use Point Mode:
            1. Select point type (Green + or Red -) for each image
            2. **Green (+)** : Click to mark areas you want to include in the mask
            3. **Red (-)** : Click to mark areas you want to exclude from the mask
            4. Click "Create Mask" button when you're done placing points
            5. The generated mask will appear below the image
            6. The masks will be transferred to Draw Mode
            7. Switch to Draw Mode to view and refine the mask if needed
            8. In Draw Mode, you can submit data to continue to the next steps.
            """)
        else:  
            st.markdown("""
            ### How to use Draw Mode:
            1. Select a drawing tool from the dropdown (freedraw, line, rect, circle, or transform)
            2. Adjust the stroke width using the slider
            3. Draw directly on the images to create or modify masks
            4. Use the transform tool to adjust existing drawings
            5. The "Clone Reference Mask to Base" option will copy the reference mask to the base image
            6. Click "Submit Mask Data" when you're satisfied with both masks
            """)

def fetch_and_resize_image(source, max_size=512):
    if source.startswith('http'):
        response = requests.get(source)
        image = Image.open(BytesIO(response.content)).convert("RGB")
    else:
        image = load_image_from_base64(source).convert("RGB")
    
    original_width, original_height = image.size
    width, height = original_width, original_height
    if max(width, height) > max_size:
        ratio = max_size / max(width, height)
        width, height = int(width * ratio), int(height * ratio)
        image = image.resize((width, height), Image.LANCZOS)
    return image, (original_width, original_height)

def main():
    streamlit_style = """
            <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@100&display=swap');

            html, body, [class*="css"]  {
            font-family: 'Roboto', sans-serif;
            }
            </style>
            """
    st.markdown(streamlit_style, unsafe_allow_html=True)

    st.title("Mask Creation")

    query_params = st.query_params
    base_url = query_params.get("base_url", "")
    reference_url = query_params.get("reference_url", "")
    email = query_params.get("email", "")

    if not base_url or not reference_url:
        st.error("No image URL provided in query parameters.")
        return

    if 'base_original_image' not in st.session_state:
        st.session_state.base_original_image, st.session_state.base_original_size = fetch_and_resize_image(base_url)
        st.session_state.base_image = st.session_state.base_original_image.resize((256, 256))
    
    if 'reference_original_image' not in st.session_state:
        st.session_state.reference_original_image, st.session_state.reference_original_size = fetch_and_resize_image(reference_url)
        st.session_state.reference_image = st.session_state.reference_original_image.resize((256, 256))

    
    st.session_state.use_sam2 = True

    page = st.sidebar.radio("Select Mode", ["Point", "Draw"])

    if page == "Point":
        show_instructions_button("Point")
        
        
        col1, col2 = st.columns(2)
        
        
       
        with col2: 
            st.subheader("Reference Image")
            process_image("reference")
        
        with col1:
            st.subheader("Base Image")
            process_image("base")
      

    elif page == "Draw":
        show_instructions_button("Draw")
     
        col1, col2 = st.columns(2)
        show_base_mask = True
        if st.session_state.use_sam2:
            show_base_mask = st.checkbox("Show Base Mask", value=True, key="show_base_mask")
        show_ref_mask = True
        clone_ref_mask = st.checkbox("Clone Reference Mask to Base", value=False, key="clone_ref_mask")

        with col1:
            st.subheader("Base Image")
            process_image_drawing("base", col1, show_base_mask, clone_ref_mask)

        with col2:
            st.subheader("Reference Image")
            process_image_drawing("reference", col2, show_ref_mask, False)

        if st.button("Submit Mask Data"):
            submit_mask_data(base_url, reference_url, email)

if __name__ == "__main__":
    main()