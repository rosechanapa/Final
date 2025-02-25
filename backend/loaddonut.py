from transformers import DonutProcessor, VisionEncoderDecoderModel
import os

# กำหนด path สำหรับบันทึกโมเดลใน Colab
cache_dir = r"D:\huggingface_cache"
donut_save_path = r"D:\Final\backend\models\OCR-Donut-CORD"

os.makedirs(cache_dir, exist_ok=True)
os.makedirs(donut_save_path, exist_ok=True)
# ดาวน์โหลด Processor และบันทึกลงเครื่อง
processor = DonutProcessor.from_pretrained("jinhybr/OCR-Donut-CORD", cache_dir=cache_dir)
processor.save_pretrained(donut_save_path + r"\processor")

# ดาวน์โหลด Model และบันทึกลงเครื่อง
model = VisionEncoderDecoderModel.from_pretrained("jinhybr/OCR-Donut-CORD", cache_dir=cache_dir)
model.save_pretrained(donut_save_path + r"\model")

print(f"Model saved to {donut_save_path}")
