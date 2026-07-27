import os

# Set U2NET_HOME environment variable BEFORE importing rembg so it uses local pre-downloaded models
os.environ["U2NET_HOME"] = os.path.abspath(os.path.join(os.path.dirname(__file__), ".u2net"))
# Disable ONNXRuntime telemetry / GPU discovery logging
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import io
import requests
from PIL import Image
from rembg import remove, new_session

app = FastAPI(title="Rembg Microservice for INCI Card")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global dictionary to lazy-load ONNX sessions on demand to preserve RAM
sessions = {}

def get_session(model_name: str = "u2netp"):
    if model_name not in sessions:
        print(f"[rembg-service] Loading ONNX CPU session for model: {model_name}...")
        providers = ['CPUExecutionProvider']
        sessions[model_name] = new_session(model_name, providers=providers)
    return sessions[model_name]

class RemoveBgRequest(BaseModel):
    image: str
    model: str = "u2netp"

@app.api_route("/", methods=["GET", "HEAD"])
@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok", "service": "rembg-service", "u2net_home": os.environ.get("U2NET_HOME"), "models_loaded": list(sessions.keys())}

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

        # Downscale input image to max 800px to guarantee RAM stays < 90MB and prevent OOM crashes on Render
        if max(input_image.width, input_image.height) > 800:
            input_image.thumbnail((800, 800), Image.Resampling.LANCZOS)

        # Lazy-load requested session ("u2net" for high precision, "u2netp" for low RAM)
        target_model = req.model if req.model in ["u2net", "u2netp", "silueta"] else "u2netp"
        session = get_session(target_model)

        # Perform AI background removal
        output_image = remove(input_image, session=session)

        buffered = io.BytesIO()
        output_image.save(buffered, format="PNG", optimize=True)
        output_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        return {"result": f"data:image/png;base64,{output_base64}"}
    except Exception as e:
        print(f"[rembg-service] Error during remove-bg: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5000))
    print(f"[rembg-service] Starting Rembg microservice on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
