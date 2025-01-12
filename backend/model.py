# import torch
# from transformers import TrOCRProcessor, VisionEncoderDecoderModel
# from PIL import Image

# # ใช้ GPU ผ่าน MPS (ถ้ามี)
# device = "mps" if torch.backends.mps.is_available() else "cpu"
# print(f"Using device: {device}")

# # โหลดโมเดล
# processor = TrOCRProcessor.from_pretrained("./models/trocr-large-handwritten/processor")
# model = VisionEncoderDecoderModel.from_pretrained("./models/trocr-large-handwritten/model").to(device)

# #processor = TrOCRProcessor.from_pretrained("./models/trocr-base-handwritten/processor")
# #model = VisionEncoderDecoderModel.from_pretrained("./models/trocr-base-handwritten/model").to(device)

# #processor = TrOCRProcessor.from_pretrained("./models/trocr-large-handwritten/processor")
# #model = VisionEncoderDecoderModel.from_pretrained("./models/trocr-base-handwritten/model").to(device)

# def predict_text(image_path, processor, model):
#     image = Image.open(image_path).convert("RGB")
#     pixel_values = processor(images=image, return_tensors="pt").pixel_values.to(device)

#     with torch.no_grad():
#         generated_ids = model.generate(pixel_values, max_new_tokens=50)  # ปรับ max_new_tokens สำหรับผลลัพธ์ที่ยาวขึ้น
#     predicted_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
#     return predicted_text

# if __name__ == "__main__":
#     image_path = "./img_test.jpg"
#     result_text = predict_text(image_path, processor, model)
#     print(f"Predicted text: {result_text}")