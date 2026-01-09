FROM python:3.8.5-buster

WORKDIR /

RUN apt-get update && apt-get install ffmpeg libsm6 libxext6 -y

COPY builder/requirements.txt .
RUN pip install -r requirements.txt

# RUN mkdir -p /checkpoints/ppt-v2/PowerPaint_Brushnet
# RUN mkdir -p /checkpoints/ppt-v2/realisticVisionV60B1_v51VAE
# RUN mkdir -p /checkpoints/ppt-v2/stable-diffusion-v1-5
# RUN mkdir -p /powerpaint

# ADD src/powerpaint .
# ADD src/checkpoints .
# ADD src/pyproject.toml .

# ADD src/handler.py .

ADD src .


CMD ["python", "-u", "/handler.py" ]