from fastapi import FastAPI, UploadFile
from paddleocr import PaddleOCR
import cv2
import numpy as np

app = FastAPI()
ocr = PaddleOCR(use_angle_cls=True, lang="en")

@app.post("/ocr")
async def ocr_image(file: UploadFile):
    content = await file.read()
    nparr = np.frombuffer(content, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    result = ocr.ocr(img)
    lines = [line[1][0] for line in result[0]]

    return {"text": lines}
