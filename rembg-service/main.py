import os

# Completely disable GPU discovery to prevent ONNXRuntime device_discovery.cc crash on Linux Render containers
os.environ["CUDA_VISIBLE_DEVICES"] = ""
os.environ["HIP_VISIBLE_DEVICES"] = ""
os.environ["ORT_DISABLE_CPU_AFFINITY"] = "1"
os.environ["OMP_PROC_BIND"] = "FALSE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

import io
import base64
import threading
import traceback
import numpy as np
import requests
from PIL import Image
import onnxruntime as ort
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Explicitly set ONNX log severity to error-only
ort.set_default_logger_severity(3)

# Set U2NET_HOME environment variable to local .u2net directory
U2NET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".u2net"))
os.environ["U2NET_HOME"] = U2NET_DIR

app = FastAPI(title="Pure ONNX Rembg Microservice for INCI Card")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global dictionary for ONNX sessions and thread lock
sessions = {}
session_lock = threading.Lock()

def get_session(model_name: str = "u2netp") -> ort.InferenceSession:
    with session_lock:
        if model_name not in sessions:
            model_filename = f"{model_name}.onnx"
            model_path = os.path.join(U2NET_DIR, model_filename)
            
            if not os.path.exists(model_path):
                model_path = os.path.join(U2NET_DIR, "u2netp.onnx")

            print(f"[rembg-service] Thread-safe CPU loading of ONNX InferenceSession from {model_path}...")
            
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 1
            opts.inter_op_num_threads = 1
            opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
            
            session = ort.InferenceSession(
                model_path,
                sess_options=opts,
                providers=['CPUExecutionProvider']
            )
            sessions[model_name] = session
            
        return sessions[model_name]

# Non-blocking daemon background thread pre-loader with thread safety
@app.on_event("startup")
def startup_event():
    def bg_load():
        try:
            print("[rembg-service] Safe background thread pre-loading ONNX session...")
            get_session("u2netp")
            print("[rembg-service] Background thread pre-load complete! Model ready.")
        except Exception as err:
            print(f"[rembg-service] Warning during background pre-load: {err}")

    threading.Thread(target=bg_load, daemon=True).start()

class RemoveBgRequest(BaseModel):
    image: str
    model: str = "u2netp"

@app.api_route("/", methods=["GET", "HEAD"])
@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    return {
        "status": "ok",
        "service": "pure-onnx-rembg-service",
        "u2net_dir": U2NET_DIR,
        "sessions": list(sessions.keys())
    }

def process_background_removal(input_image: Image.Image, session: ort.InferenceSession) -> Image.Image:
    # 1. Downscale input image to max 1200px first to guarantee lightweight processing
    if max(input_image.width, input_image.height) > 1200:
        input_image.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        
    target_w, target_h = input_image.size
    
    # 2. Resize to 320x320 for U2-Net ONNX model input
    img_rgb = input_image.convert("RGB").resize((320, 320), Image.Resampling.LANCZOS)
    
    # 3. Normalize image array
    arr = np.array(img_rgb, dtype=np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr = (arr - mean) / std
    
    # 4. Transpose to C-contiguous (1, 3, 320, 320) tensor to prevent C++ memory access violations
    tensor = np.ascontiguousarray(np.expand_dims(arr.transpose((2, 0, 1)), 0).astype(np.float32))
    
    # 5. Run ONNX Inference with thread lock to ensure single-threaded execution on Render CPU
    with session_lock:
        input_name = session.get_inputs()[0].name
        output = session.run(None, {input_name: tensor})[0]
    
    # 6. Extract alpha mask tensor (1, 1, 320, 320) -> (target_w, target_h)
    mask_arr = np.ascontiguousarray(output[0, 0])
    ma = np.max(mask_arr)
    mi = np.min(mask_arr)
    if ma > mi:
        mask_arr = (mask_arr - mi) / (ma - mi)
    else:
        mask_arr = np.zeros_like(mask_arr)
        
    mask_img = Image.fromarray((mask_arr * 255).astype(np.uint8), mode="L")
    mask_img = mask_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    # 7. Apply mask as alpha channel
    output_image = input_image.convert("RGBA")
    output_image.putalpha(mask_img)
    return output_image

@app.post("/remove-bg")
async def remove_bg(req: RemoveBgRequest):
    step = "start"
    try:
        step = "check_data"
        data = req.image
        if not data:
            return {"error": "No image provided"}

        step = "base64_decode"
        if "base64," in data:
            data = data.split("base64,")[1]
        image_bytes = base64.b64decode(data)

        step = "pil_open"
        input_image = Image.open(io.BytesIO(image_bytes))

        step = "get_session"
        session = get_session(req.model)

        step = "process_removal"
        output_image = process_background_removal(input_image, session)

        step = "save_png"
        buffered = io.BytesIO()
        output_image.save(buffered, format="PNG")

        step = "base64_encode"
        output_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        return {"result": f"data:image/png;base64,{output_base64}"}
    except Exception as e:
        err_msg = f"Failed at step [{step}]: {str(e)}\n{traceback.format_exc()}"
        print(f"[rembg-service] {err_msg}")
        return {"error": err_msg}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5000))
    print(f"[rembg-service] Starting Pure ONNX Rembg microservice on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
