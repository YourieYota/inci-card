import os
import io
import base64
import numpy as np
import requests
from PIL import Image
import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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

# Global dictionary for ONNX sessions
sessions = {}

def get_session(model_name: str = "u2netp") -> ort.InferenceSession:
    if model_name not in sessions:
        model_filename = f"{model_name}.onnx"
        model_path = os.path.join(U2NET_DIR, model_filename)
        
        if not os.path.exists(model_path):
            # Fallback to u2netp if specific model path doesn't exist
            model_path = os.path.join(U2NET_DIR, "u2netp.onnx")

        print(f"[rembg-service] Loading ONNX InferenceSession from {model_path}...")
        
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 1
        opts.inter_op_num_threads = 1
        
        session = ort.InferenceSession(
            model_path,
            sess_options=opts,
            providers=['CPUExecutionProvider']
        )
        sessions[model_name] = session
        
    return sessions[model_name]

# Asynchronous startup event handler so port binding happens instantly
@app.on_event("startup")
def startup_event():
    try:
        print("[rembg-service] Pre-loading default u2netp ONNX session during app startup...")
        get_session("u2netp")
        print("[rembg-service] ONNX session ready! Microservice is ready for instant inference.")
    except Exception as err:
        print(f"[rembg-service] Warning during startup pre-load: {err}")

class RemoveBgRequest(BaseModel):
    image: str
    model: str = "u2netp"

@app.api_route("/", methods=["GET", "HEAD"])
@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {
        "status": "ok",
        "service": "pure-onnx-rembg-service",
        "u2net_dir": U2NET_DIR,
        "sessions": list(sessions.keys())
    }

def process_background_removal(input_image: Image.Image, session: ort.InferenceSession) -> Image.Image:
    # 1. Downscale input image to max 800px first to guarantee lightweight processing
    if max(input_image.width, input_image.height) > 800:
        input_image.thumbnail((800, 800), Image.Resampling.LANCZOS)
        
    target_w, target_h = input_image.size
    
    # 2. Resize to 320x320 for U2-Net ONNX model input
    img_rgb = input_image.convert("RGB").resize((320, 320), Image.Resampling.LANCZOS)
    
    # 3. Normalize image array
    arr = np.array(img_rgb, dtype=np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr = (arr - mean) / std
    
    # 4. Transpose to C-contiguous (1, 3, 320, 320) tensor
    tensor = np.ascontiguousarray(np.expand_dims(arr.transpose((2, 0, 1)), 0).astype(np.float32))
    
    # 5. Run ONNX Inference
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
def remove_bg(req: RemoveBgRequest):
    try:
        data = req.image
        if not data:
            raise HTTPException(status_code=400, detail="No image provided")

        image_bytes = None

        if data.startswith("data:") or "base64," in data:
            base64_data = data.split("base64,")[1]
            image_bytes = base64.b64decode(base64_data)
        elif data.startswith("http://") or data.startswith("https://"):
            res = requests.get(data, timeout=15)
            if res.status_code == 200:
                image_bytes = res.content
            else:
                raise HTTPException(status_code=400, detail=f"Failed to fetch image HTTP {res.status_code}")
        else:
            image_bytes = base64.b64decode(data)

        if not image_bytes:
            raise HTTPException(status_code=400, detail="Could not read image bytes")

        input_image = Image.open(io.BytesIO(image_bytes))

        session = get_session(req.model)
        output_image = process_background_removal(input_image, session)

        buffered = io.BytesIO()
        output_image.save(buffered, format="PNG")
        output_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        return {"result": f"data:image/png;base64,{output_base64}"}
    except Exception as e:
        print(f"[rembg-service] Error during remove-bg: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5000))
    print(f"[rembg-service] Starting Pure ONNX Rembg microservice on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
