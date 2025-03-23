from python:3.8.5-buster


WORKDIR /

# COPY check.sh /
# RUN chmod +x check.sh
# ENTRYPOINT ["bash", "check.sh"]

COPY builder/requirements.txt .
RUN pip install -r requirements.txt

ADD src .

CMD ["python", "-u", "/handler.py" ]