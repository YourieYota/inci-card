FROM python:3.11-slim

WORKDIR /app

# Completely disable GPU discovery to prevent ONNXRuntime device_discovery.cc crash under Render Linux containers
ENV CUDA_VISIBLE_DEVICES=""
ENV HIP_VISIBLE_DEVICES=""
ENV ORT_DISABLE_CPU_AFFINITY="1"
ENV OMP_PROC_BIND="FALSE"
ENV OMP_NUM_THREADS="1"
ENV U2NET_HOME=/app/.u2net

# Install system dependencies (including libgomp1 for ONNXRuntime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000
EXPOSE 10000

CMD ["python", "main.py"]
