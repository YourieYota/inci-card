FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download lightweight u2netp.onnx model directly into Docker cache during build phase
RUN mkdir -p /root/.u2net && \
    curl -L -o /root/.u2net/u2netp.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx

COPY . .

# Let Render dynamically assign $PORT (defaults to 5000 if PORT is unset)
EXPOSE 5000
EXPOSE 10000

CMD ["python", "main.py"]
