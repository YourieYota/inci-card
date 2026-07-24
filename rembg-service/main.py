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

# Pre-load ONNX session for fast AI inference (u2net model)
session = new_session("u2net")

class RemoveBgRequest(BaseModel):
    image: str

@app.get("/")
@app.get("/health")
def health():
    return {"status": "ok", "service": "rembg-service", "model": "u2net"}

@app.post("/remove-bg")
def remove_bg(req: RemoveBgRequest):
    try:
        data = req.image
        if not data:
            raise HTTPException(status_code=400, detail="No image provided")

        image_bytes = None

        # 1. Handle base64 data URLs
        if data.startswith("data:") or "base64," in data:
            base64_data = data.split("base64,")[1]
            image_bytes = base64.b64decode(base64_data)
        # 2. Handle HTTP URLs
        elif data.startswith("http://") or data.startswith("https://"):
            res = requests.get(data, timeout=10)
            if res.status_code == 200:
                image_bytes = res.content
            else:
                raise HTTPException(status_code=400, detail=f"Failed to fetch image HTTP {res.status_code}")
        # 3. Handle raw base64
        else:
            image_bytes = base64.b64decode(data)

        if not image_bytes:
            raise HTTPException(status_code=400, detail="Could not read image bytes")

        input_image = Image.open(io.BytesIO(image_bytes))

        # Perform AI background removal using rembg
        output_image = remove(input_image, session=session)

        # Convert result back to transparent PNG Data URL
        buffered = io.BytesIO()
        output_image.save(buffered, format="PNG")
        output_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        return {"result": f"data:image/png;base64,{output_base64}"}
    except Exception as e:
        print(f"[rembg-service] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("[rembg-service] Starting Rembg microservice on port 5000...")
    uvicorn.run(app, host="0.0.0.0", port=5000)
