FROM python:3.11-slim

WORKDIR /app

# Set U2NET_HOME environment variable to /app/.u2net so rembg uses local pre-downloaded ONNX models
ENV U2NET_HOME=/app/.u2net

# Install system dependencies (including libgomp1 required for ONNXRuntime OpenMP execution engine)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download lightweight u2netp.onnx model directly into /app/.u2net cache directory
RUN mkdir -p /app/.u2net && \
    curl -L -o /app/.u2net/u2netp.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx

COPY . .

EXPOSE 5000
EXPOSE 10000

CMD ["python", "main.py"]
