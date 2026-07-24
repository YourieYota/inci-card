from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import io
import os
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

session = new_session("u2netp")

class RemoveBgRequest(BaseModel):
    image: str

# Support both GET and HEAD requests for Render's health checks
@app.api_route("/", methods=["GET", "HEAD"])
@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok", "service": "rembg-service", "model": "u2netp"}

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
            res = requests.get(data, timeout=10)
            if res.status_code == 200:
                image_bytes = res.content
            else:
                raise HTTPException(status_code=400, detail=f"Failed to fetch image HTTP {res.status_code}")
        else:
            image_bytes = base64.b64decode(data)

        if not image_bytes:
            raise HTTPException(status_code=400, detail="Could not read image bytes")

        input_image = Image.open(io.BytesIO(image_bytes))

        # Perform fast AI background removal with lightweight model
        output_image = remove(input_image, session=session)

        buffered = io.BytesIO()
        output_image.save(buffered, format="PNG")
        output_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        return {"result": f"data:image/png;base64,{output_base64}"}
    except Exception as e:
        print(f"[rembg-service] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5000))
    print(f"[rembg-service] Starting lightweight Rembg microservice on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
