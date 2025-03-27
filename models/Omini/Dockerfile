FROM pytorch/pytorch:2.0.1-cuda11.7-cudnn8-runtime

WORKDIR /

# Copy and install Python dependencies
COPY builder/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code (handler script, model code, etc.)
ADD src .
 
# Run optional path updater and then the handler (unbuffered output)
CMD ["sh", "-c", "python -u /update_yaml_paths.py && python -u /handler.py"]
