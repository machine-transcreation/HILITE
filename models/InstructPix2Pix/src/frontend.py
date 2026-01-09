import requests
import streamlit as st
from PIL import Image
from io import BytesIO

@st.cache_data
def endpoint_url():
    return "http://localhost:4200/instruct/"

st.set_page_config(page_title = "Instruct Pix2Pix", page_icon = ":robot:", layout = "wide")
st.title("Instruct-Pix2Pix: Image Editing using Text")

uploaded_file = st.file_uploader("Upload Image", type=['png', 'jpg'], accept_multiple_files=False)

if uploaded_file is not None:
    st.image(uploaded_file, width = 175, caption="Uploaded Image", use_column_width=False)

with st.form(key = "process_form"):
    edit_prompt = st.text_input("Edit Instruction")
    with st.expander("Advanced Options"):
        steps = st.slider("Steps", min_value = 1, max_value = 200, step = 1, value = 100)
        cfg_text = st.slider("Text Guidance Scale", min_value = 0.1, max_value = 15.0, step = 0.05, value = 7.5)
        cfg_img = st.slider("Image Guidance Scale", min_value = 0.1, max_value = 10.0, step = 0.05, value = 1.5)
        resolution = st.number_input("Resolution", value = 512)
        seed = st.number_input("Seed", value = None)
    
    with st.expander("Tips"):
        st.markdown('''
            Image changing too little?
            - Increase text guidance scale and/or decrease image guidance scale.
        
            Image changing too much?
            - Decrease text guidance scale and/or increase image guidance scale.
        ''')    

    submit_button = st.form_submit_button("Edit Image", disabled = False)

    

if (submit_button):
    with st.spinner("Editing image..."):
        payload = {
            "edit_prompt": edit_prompt, 
            "resolution": resolution, 
            "steps": steps, 
            "cfg_text": cfg_text, 
            "cfg_image": cfg_img,
            "seed": seed
        }
        response = requests.post(endpoint_url(), params = payload, files = {"image_file": uploaded_file.read()}, stream = True).content

    st.header('Output')
    st.image(Image.open(BytesIO(response)), caption = "Generated Image")
    pass