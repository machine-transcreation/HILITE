from python:3.9.2-buster

WORKDIR /

RUN apt-get update && apt-get install ffmpeg libsm6 libxext6  -y

COPY builder/requirements.txt .
RUN pip install -r requirements.txt

ADD src .

CMD ["python", "-u", "/handler.py" ]