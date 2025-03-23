FROM python:3.8.5-buster

WORKDIR /

COPY builder/requirements.txt .
RUN pip install -r requirements.txt

ADD src .

CMD ["python", "-u", "/handler.py"]
