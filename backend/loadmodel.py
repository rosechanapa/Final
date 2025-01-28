from transformers import TrOCRProcessor, VisionEncoderDecoderModel
import os

# กำหนดตำแหน่ง Cache Directory ไปที่ไดรฟ์ D
cache_dir = r"D:\huggingface_cache"  # ตำแหน่งใหม่สำหรับ Cache
base_save_path = r"D:\Final\backend\models\trocr-base-handwritten"  
large_save_path = r"D:\Final\backend\models\trocr-large-handwritten" 

# สร้างโฟลเดอร์หากยังไม่มี
os.makedirs(cache_dir, exist_ok=True)
# os.makedirs(base_save_path, exist_ok=True)
os.makedirs(large_save_path, exist_ok=True)

# # ดาวน์โหลดและบันทึก trocr-base-handwritten
print("Downloading trocr-base-handwritten...")
base_processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten", cache_dir=cache_dir)
base_model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten", cache_dir=cache_dir)
base_processor.save_pretrained(base_save_path + r"\processor")
base_model.save_pretrained(base_save_path + r"\model")
print(f"trocr-base-handwritten saved to {base_save_path}")

# ดาวน์โหลดและบันทึก trocr-large-handwritten
print("Downloading trocr-large-handwritten...")
large_processor = TrOCRProcessor.from_pretrained("microsoft/trocr-large-handwritten", cache_dir=cache_dir)
large_model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-large-handwritten", cache_dir=cache_dir)
large_processor.save_pretrained(large_save_path + r"\processor")
large_model.save_pretrained(large_save_path + r"\model")
print(f"trocr-large-handwritten saved to {large_save_path}")
