import sys
from pdf2image import convert_from_path
import fitz  # PyMuPDF for handling PDFs
import cv2
import numpy as np
import os
from db import get_db_connection
import json
from time import sleep
import torch
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image
import re  
import easyocr  
import requests
from sheet import stop_flag # ดึง stop_flag เข้ามาใช้งาน

import ssl
ssl._create_default_https_context = ssl._create_unverified_context

# ใช้ GPU 
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

# โหลดโมเดลเพียงครั้งเดียว
print("Loading models...")
reader = easyocr.Reader(['en'],  gpu=True , model_storage_directory="./models/easyocr/")

# โหลดโมเดล TrOCR ครั้งเดียว
large_processor = TrOCRProcessor.from_pretrained("./models/trocr-large/processor")
large_trocr_model = VisionEncoderDecoderModel.from_pretrained(
    "./models/trocr-large/model",
    torch_dtype=torch.float16 if device == "cuda" else torch.float32
).to(device)

base_processor = TrOCRProcessor.from_pretrained("./models/trocr-large/processor")
base_trocr_model = VisionEncoderDecoderModel.from_pretrained(
    "./models/trocr-base/model",
    torch_dtype=torch.float16 if device == "cuda" else torch.float32
).to(device)

print("Models loaded successfully!")


#----------------------- convert img ----------------------------
def convert_pdf(pdf_buffer, subject_id, page_no):
    try:
        # เชื่อมต่อฐานข้อมูล
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. ค้นหา Page_id จาก Subject_id และ page_no
        cursor.execute("SELECT Page_id FROM Page WHERE Subject_id = %s AND Page_no = %s", (subject_id, page_no))
        page = cursor.fetchone()
        if not page:
            print("ไม่พบ Page_id สำหรับ Subject_id และ Page_no ที่ระบุ")
            return {"success": False, "message": f"ไม่พบหน้าที่ {page_no} สำหรับ Subject ID: {subject_id}"}
        page_id = page["Page_id"]

        # เปิด PDF จาก buffer
        pdf_document = fitz.open(stream=pdf_buffer.getvalue(), filetype="pdf")

        # สร้างโฟลเดอร์สำหรับบันทึกผลลัพธ์
        folder_path = f'./{subject_id}/predict_img/{page_no}'
        os.makedirs(folder_path, exist_ok=True)

        # วนลูปสำหรับแต่ละหน้าใน PDF
        for page_number in range(len(pdf_document)):
            page = pdf_document[page_number]
            pix = page.get_pixmap(dpi=300)  # DPI สูงเพื่อความคมชัด
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

            # แปลงภาพเป็นรูปแบบที่ OpenCV ใช้งานได้
            if pix.n == 4:
                img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
            else:
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

            # ปรับขนาดภาพเป็นขนาด A4
            width, height = 2480, 3508
            img_resized = cv2.resize(img, (width, height))

            # เปลี่ยนเป็นสีเทาและทำ Threshold
            gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)

            # ค้นหา Contours
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            detected_boxes = []

            def filter_corners(detected_boxes, image_width, image_height):
                    corners = []
                    threshold = 500  # ค่าความใกล้เคียงระหว่างพิกัดกล่องกับตำแหน่งมุม
            
                    for box in detected_boxes:
                        x1, y1, x2, y2 = box
                        # คำนวณตำแหน่งศูนย์กลางของกล่อง
                        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2

                        # ตรวจสอบว่าเป็นกล่องมุมหรือไม่
                        if (
                            (abs(cx - 0) < threshold and abs(cy - 0) < threshold) or  # มุมบนซ้าย
                            (abs(cx - image_width) < threshold and abs(cy - 0) < threshold) or  # มุมบนขวา
                            (abs(cx - 0) < threshold and abs(cy - image_height) < threshold) or  # มุมล่างซ้าย
                            (abs(cx - image_width) < threshold and abs(cy - image_height) < threshold)  # มุมล่างขวา
                        ):
                            corners.append(box)
                    
                    return corners
                
            def sort_corners(corner_boxes):
        
                    corner_boxes = sorted(corner_boxes, key=lambda box: box[1])  # เรียงตาม Y1 (พิกัดแนวตั้ง)
                    top_boxes = corner_boxes[:2]  # สองกล่องด้านบน
                    bottom_boxes = corner_boxes[2:]  # สองกล่องด้านล่าง

                    # เรียงกล่องบน (ซ้าย-ขวา) โดยใช้ค่า X
                    top_boxes = sorted(top_boxes, key=lambda box: box[0])  # เรียงตาม X1
                    # เรียงกล่องล่าง (ซ้าย-ขวา) โดยใช้ค่า X
                    bottom_boxes = sorted(bottom_boxes, key=lambda box: box[0])

                    # จัดลำดับกล่องตามลำดับที่ต้องการ
                    return [
                        bottom_boxes[1],  # กล่องขวาล่าง (Box 1)
                        bottom_boxes[0],  # กล่องซ้ายล่าง (Box 2)
                        top_boxes[1],     # กล่องขวาบน (Box 3)
                        top_boxes[0],     # กล่องซ้ายบน (Box 4)
                    ]
                            
            detected_boxes = []
            for contour in contours:
                    approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
                    if len(approx) == 4:
                        x, y, w, h = cv2.boundingRect(approx)
                        if 50 < w < 200 and 50 < h < 200:
                            detected_boxes.append((x, y, x + w, y + h))
                
            corner_boxes = filter_corners(detected_boxes, img_resized.shape[1], img_resized.shape[0])
            if len(corner_boxes) == 4:
                    sorted_boxes = sort_corners(corner_boxes)     
                    src_points = np.array([
                        [sorted_boxes[3][0], sorted_boxes[3][1]],  # มุมบนซ้าย
                        [sorted_boxes[2][2], sorted_boxes[2][1]],  # มุมบนขวา
                        [sorted_boxes[1][0], sorted_boxes[1][3]],  # มุมล่างซ้าย
                        [sorted_boxes[0][2], sorted_boxes[0][3]],  # มุมล่างขวา
                    ], dtype='float32')

                    # กำหนดตำแหน่งเป้าหมายที่ต้องการให้กล่องตรง (destination points)
                    dst_points = np.array([
                        [150, 100],     # มุมบนซ้าย
                        [2330, 100],    # มุมบนขวา
                        [150, 3408],    # มุมล่างซ้าย
                        [2330, 3408]    # มุมล่างขวา
                    ], dtype='float32')

                    # คำนวณ Homography และแปลงภาพ
                    matrix, status = cv2.findHomography(src_points, dst_points, cv2.RANSAC, 3.0)
                    resized_image = cv2.warpPerspective(img_resized, matrix, (2480, 3508), borderMode=cv2.BORDER_REPLICATE)      

            else:
                    print(f"ไม่พบกล่องสี่เหลี่ยม 4 กล่องในหน้า {page_number + 1}")


            # 2. เพิ่มค่า Page_id ลงในตาราง Exam_sheet
            cursor.execute("INSERT INTO Exam_sheet (Page_id) VALUES (%s)", (page_id,))
            conn.commit()

            # 3. เก็บค่า Sheet_id ที่เพิ่มไว้ในตัวแปร name
            sheet_id = cursor.lastrowid  # ได้ค่า Sheet_id ล่าสุด
            name = f"{sheet_id}"  # ตั้งชื่อเป็น Sheet_ID เช่น "1"

            # บันทึกภาพที่ปรับแล้ว
            output_path = os.path.join(folder_path, f"{name}.jpg")
            cv2.imwrite(output_path, resized_image)
            print(f"บันทึกภาพ: {output_path}")

        print("การประมวลผลเสร็จสมบูรณ์")
        return {"success": True, "message": "แปลงหน้าสำเร็จ"}
    except Exception as e:
        print(f"Error in convert_pdf: {e}")
        return {"success": False, "message": str(e)}
    finally:
        # ปิดการเชื่อมต่อฐานข้อมูลเสมอ
        if cursor:
            cursor.close()
        if conn:
            conn.close()
  

def convert_allpage(pdf_buffer, subject_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # ดึงข้อมูล Page_id และ page_no จากฐานข้อมูลตาม Subject ID
        cursor.execute("SELECT Page_id, Page_no FROM Page WHERE Subject_id = %s", (subject_id,))
        pages = cursor.fetchall()

        if not pages:
            print(f"ไม่พบหน้าสำหรับ Subject ID: {subject_id}")
            return {"success": False, "message": f"ไม่พบหน้าสำหรับ Subject ID: {subject_id}"}

        # เปิด PDF จาก buffer
        pdf_document = fitz.open(stream=pdf_buffer.getvalue(), filetype="pdf")

        # กรณีไฟล์ PDF มีหน้าไม่ครบ
        num_pdf_pages = len(pdf_document)
        num_db_pages = len(pages)

        # คำนวณจำนวนรอบที่จะวน loop
        remaining_pages = num_pdf_pages % num_db_pages  # หน้าที่เหลือจากการหาร

        if remaining_pages > 0:  # ถ้ามีหน้าที่เหลืออยู่และไม่ครบจำนวนในรอบ
            return {
                "success": False,
                "message": f"ไม่สามารถวนรอบได้ครบ: PDF มี {num_pdf_pages} หน้า แต่ต้องการวนครั้งละ {num_db_pages} หน้า"
            }
        

        # วนลูปสำหรับทุกหน้าใน PDF
        for page_number in range(len(pdf_document)):
            page_data = pages[page_number % len(pages)]  # เลือกข้อมูลจาก pages แบบวนซ้ำ
            page_id = page_data["Page_id"]
            page_no_current = page_data["Page_no"]

            # แปลงหน้า PDF เป็นภาพ
            page = pdf_document[page_number]
            pix = page.get_pixmap(dpi=300)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

            # แปลงภาพเป็นรูปแบบที่ OpenCV ใช้งานได้
            if pix.n == 4:
                img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
            else:
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

            # ปรับขนาดภาพเป็นขนาด A4
            width, height = 2480, 3508
            img_resized = cv2.resize(img, (width, height))

            # เปลี่ยนเป็นสีเทาและทำ Threshold
            gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)

            # ค้นหา Contours
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            
            def filter_corners(detected_boxes, image_width, image_height):
                corners = []
                threshold = 500  # ค่าความใกล้เคียงระหว่างพิกัดกล่องกับตำแหน่งมุม
        
                for box in detected_boxes:
                    x1, y1, x2, y2 = box
                    # คำนวณตำแหน่งศูนย์กลางของกล่อง
                    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2

                    # ตรวจสอบว่าเป็นกล่องมุมหรือไม่
                    if (
                        (abs(cx - 0) < threshold and abs(cy - 0) < threshold) or  # มุมบนซ้าย
                        (abs(cx - image_width) < threshold and abs(cy - 0) < threshold) or  # มุมบนขวา
                        (abs(cx - 0) < threshold and abs(cy - image_height) < threshold) or  # มุมล่างซ้าย
                        (abs(cx - image_width) < threshold and abs(cy - image_height) < threshold)  # มุมล่างขวา
                    ):
                        corners.append(box)
                
                return corners
            
            def sort_corners(corner_boxes):
      
                corner_boxes = sorted(corner_boxes, key=lambda box: box[1])  # เรียงตาม Y1 (พิกัดแนวตั้ง)
                top_boxes = corner_boxes[:2]  # สองกล่องด้านบน
                bottom_boxes = corner_boxes[2:]  # สองกล่องด้านล่าง

                # เรียงกล่องบน (ซ้าย-ขวา) โดยใช้ค่า X
                top_boxes = sorted(top_boxes, key=lambda box: box[0])  # เรียงตาม X1
                # เรียงกล่องล่าง (ซ้าย-ขวา) โดยใช้ค่า X
                bottom_boxes = sorted(bottom_boxes, key=lambda box: box[0])

                # จัดลำดับกล่องตามลำดับที่ต้องการ
                return [
                    bottom_boxes[1],  # กล่องขวาล่าง (Box 1)
                    bottom_boxes[0],  # กล่องซ้ายล่าง (Box 2)
                    top_boxes[1],     # กล่องขวาบน (Box 3)
                    top_boxes[0],     # กล่องซ้ายบน (Box 4)
                ]
                           
            detected_boxes = []
            for contour in contours:
                approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
                if len(approx) == 4:
                    x, y, w, h = cv2.boundingRect(approx)
                    if 50 < w < 200 and 50 < h < 200:
                        detected_boxes.append((x, y, x + w, y + h))
            
            corner_boxes = filter_corners(detected_boxes, img_resized.shape[1], img_resized.shape[0])
            if len(corner_boxes) == 4:
                sorted_boxes = sort_corners(corner_boxes)     
                src_points = np.array([
                    [sorted_boxes[3][0], sorted_boxes[3][1]],  # มุมบนซ้าย
                    [sorted_boxes[2][2], sorted_boxes[2][1]],  # มุมบนขวา
                    [sorted_boxes[1][0], sorted_boxes[1][3]],  # มุมล่างซ้าย
                    [sorted_boxes[0][2], sorted_boxes[0][3]],  # มุมล่างขวา
                ], dtype='float32')

                # กำหนดตำแหน่งเป้าหมายที่ต้องการให้กล่องตรง (destination points)
                dst_points = np.array([
                    [150, 100],     # มุมบนซ้าย
                    [2330, 100],    # มุมบนขวา
                    [150, 3408],    # มุมล่างซ้าย
                    [2330, 3408]    # มุมล่างขวา
                ], dtype='float32')

                # คำนวณ Homography และแปลงภาพ
                matrix, status = cv2.findHomography(src_points, dst_points, cv2.RANSAC, 3.0)
                resized_image = cv2.warpPerspective(img_resized, matrix, (2480, 3508), borderMode=cv2.BORDER_REPLICATE)      

            else:
                print(f"ไม่พบกล่องสี่เหลี่ยม 4 กล่องในหน้า {page_number + 1}")

            # เพิ่มค่า Page_id ลงในตาราง Exam_sheet
            cursor.execute("INSERT INTO Exam_sheet (Page_id) VALUES (%s)", (page_id,))
            conn.commit()

            # เก็บค่า Sheet_id ที่เพิ่มไว้ในตัวแปร name
            sheet_id = cursor.lastrowid
            name = f"{sheet_id}"

            # สร้างโฟลเดอร์สำหรับเก็บภาพ
            folder_path = f'./{subject_id}/predict_img/{page_no_current}'
            os.makedirs(folder_path, exist_ok=True)

            # บันทึกภาพที่ปรับแล้ว
            output_path = os.path.join(folder_path, f"{name}.jpg")
            cv2.imwrite(output_path, resized_image)
            print(f"บันทึกภาพ: {output_path}")

        cursor.close()
        conn.close()
        print("การประมวลผลเสร็จสมบูรณ์")
        return {"success": True, "message": "แปลงหน้าสำเร็จ"}
    except Exception as e:
        return {"success": False, "message": str(e)}

#----------------------- predict ----------------------------
def check(new_subject, new_page, socketio):
    subject = new_subject
    page = new_page

    conn = get_db_connection()
    cursor = conn.cursor()

    # ค้นหา Page_id ที่ตรงกับ Subject_id และ page_no
    page_query = """
        SELECT Page_id 
        FROM Page 
        WHERE Subject_id = %s AND Page_no = %s
    """
    cursor.execute(page_query, (subject, page))
    result = cursor.fetchone()

    if result:
        page_id = result[0]

        # ค้นหา Sheet_id ที่ score เป็น NULL และ Page_id ตรงกัน
        exam_sheet_query = """
            SELECT Sheet_id 
            FROM Exam_sheet 
            WHERE Page_id = %s AND Score IS NULL
        """
        cursor.execute(exam_sheet_query, (page_id,))
        sheets = [row[0] for row in cursor.fetchall()]

        # แสดงค่าใน array sheets
        print(f"Sheet IDs with NULL score for Page_id {page_id}: {sheets}")

        # ปิดการเชื่อมต่อฐานข้อมูล
        cursor.close()
        conn.close()

        # เรียกฟังก์ชัน predict ด้วย array sheets, subject, page
        predict(sheets, subject, page, socketio)

    else:
        print(f"No Page found for Subject_id: {subject}, Page_no: {page}")
        cursor.close()
        conn.close()
 

def x_image(image):
    # แปลงภาพเป็นขาวดำ
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # เบลอภาพเพื่อลด noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Threshold เพื่อแยกตัวอักษร
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # หา contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    chars = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)

        # เพิ่มการกรอง bounding box ด้วย Aspect Ratio
        aspect_ratio = w / float(h)
        if (0.2 <= aspect_ratio <= 1.0) and (w >= 5 and h >= 15):  # ตัวอักษรปกติมี Aspect Ratio ในช่วงนี้
            chars.append((x, y, w, h))

    # ส่งคืนจำนวนตัวอักษรที่พบ
    return len(chars)


def predict_image(image):
    # สร้างสำเนาของภาพต้นฉบับเพื่อแสดงผล
    output_image = image.copy()

    # === ขั้นตอน Preprocessing ===
    # แปลงภาพเป็น Grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # ใช้ CLAHE เพื่อปรับปรุงความคมชัดของภาพ
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    # ใช้ GaussianBlur เพื่อลด Noise
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)

    # ใช้ Threshold แบบ Adaptive เพื่อลดผลกระทบจากแสง
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, 11, 3)

    # ใช้ Morphological Transformations เพื่อแยกตัวอักษรที่ติดกัน
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    processed_image = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=1)

    # ใช้ EasyOCR เพื่ออ่านข้อความจากภาพที่ผ่านการ Preprocessing
    results = reader.readtext(processed_image)

    # ตัวแปรสำหรับนับตัวอักษร
    num_chars = 0

    # วาด bounding box และนับตัวอักษร
    for result in results:
        bbox, text, confidence = result
        # ลบเว้นวรรค และจุดออกจากข้อความ
        text = text.replace(" ", "").replace(".", "")

        # นับจำนวนตัวอักษรในข้อความที่ไม่มีเว้นวรรค
        num_chars += len(text)

        # ดึงตำแหน่ง bounding box
        top_left = tuple([int(val) for val in bbox[0]])
        bottom_right = tuple([int(val) for val in bbox[2]])

        # วาด bounding box ลงบนภาพ
        cv2.rectangle(output_image, top_left, bottom_right, (0, 255, 0), 2)
        cv2.putText(output_image, text, (top_left[0], top_left[1] - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1, cv2.LINE_AA)

    # แสดงผลภาพ (ใช้ #cv2_imshow ใน Colab)
    #cv2_imshow(output_image)

    # ส่งคืนจำนวนตัวอักษรที่ตรวจจับได้ (ไม่นับเว้นวรรค)
    return num_chars



def perform_prediction(pixel_values, label, roi=None, box_index=None):

    # ย้าย pixel_values ไปยัง MPS
    pixel_values = pixel_values.to(device)

    # พยากรณ์สำหรับ label
    if label == "sentence":
        # ตรวจสอบว่า roi ถูกส่งมา
        if roi is not None:
            # ลบขอบ จากทั้ง 4 ด้าน
            roi = roi[10:roi.shape[0] - 10, 10:roi.shape[1] - 10]

            # เรียกใช้ฟังก์ชัน predict_image และรับผลลัพธ์การพยากรณ์
            count = predict_image(roi)

            # ทำการพยากรณ์ predicted_2
            generated_ids = large_trocr_model.generate(pixel_values, max_new_tokens=50)
            predicted_2 = large_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

            if count == 0:
                predicted_text = predicted_2
            else:
                # กำหนด predicted_text โดยไม่นับ " " และ "."
                #print(count)
                predicted_text = ""
                char_count = 0  # ตัวนับจำนวนตัวอักษร (ไม่นับ " " และ ".")
                for char in predicted_2:
                    if char not in [" ", "."]:
                        char_count += 1
                    predicted_text += char

                    # ออกจากลูปทันทีหากข้อความสั้นกว่าจำนวน count
                    if len(predicted_2.replace(" ", "").replace(".", "")) < count:
                        predicted_text = predicted_2
                        break

                    # หยุดการวนลูปหากนับครบจำนวน count
                    if char_count >= count:
                        break

            # ตรวจสอบและลบ " เว้นวรรค + 1 ตัวอักษร/เลข/อักขระ" ที่ท้ายประโยค
            #print(f"Original predicted_text: '{predicted_text}'")  # Debugging
            if len(predicted_text) > 2 and predicted_text[-2] == " " and len(predicted_text[-1].strip()) == 1:
                predicted_text = predicted_text[:-2]  # ลบสองตัวอักษรสุดท้าย (เว้นวรรค + ตัวอักษร/เลข/อักขระ)

        else:
            print("Error: ROI is not provided for sentence prediction.")
            predicted_text = "-"



    elif label == "id":
        generated_ids = large_trocr_model.generate(pixel_values, max_new_tokens=3)
        predicted_text = large_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

        # ตรวจสอบว่า "B" หรือ "b" อยู่ในข้อความที่ทำนาย
        if 'B' in predicted_text or 'b' in predicted_text:
            # แทนที่ "B" หรือ "b" ด้วย "6"
            predicted_text = predicted_text.replace('B', '6').replace('b', '6')
        if 'O' in predicted_text or 'o' in predicted_text:
            predicted_text = predicted_text.replace('O', '0').replace('o', '0')
        if 'L' in predicted_text or 'l' in predicted_text:
                predicted_text = predicted_text.replace('L', '1').replace('l', '1')
        if 'I' in predicted_text or 'i' in predicted_text:
            predicted_text = predicted_text.replace('I', '1').replace('i', '1')

        # กรองเฉพาะตัวเลข
        predicted_text = re.sub(r'\D', '-', predicted_text)[:1]

    elif label == "number":
        generated_ids = base_trocr_model.generate(pixel_values, max_new_tokens=3)
        predicted_text = base_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

        # ตรวจสอบว่า "B" หรือ "b" อยู่ในข้อความที่ทำนาย
        if 'B' in predicted_text or 'b' in predicted_text:
            # แทนที่ "B" หรือ "b" ด้วย "6"
            predicted_text = predicted_text.replace('B', '6').replace('b', '6')
        if 'O' in predicted_text or 'o' in predicted_text:
            predicted_text = predicted_text.replace('O', '0').replace('o', '0')
        if 'L' in predicted_text or 'l' in predicted_text:
                predicted_text = predicted_text.replace('L', '1').replace('l', '1')
        if 'I' in predicted_text or 'i' in predicted_text:
            predicted_text = predicted_text.replace('I', '1').replace('i', '1')

        # กรองเฉพาะตัวเลข
        predicted_text = re.sub(r'\D', '-', predicted_text)[:1]

    elif label == "character":
        generated_ids = large_trocr_model.generate(pixel_values, max_new_tokens=3)
        predicted_text = large_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

        if '0' in predicted_text:
            predicted_text = predicted_text.replace('0', 'o')      
        if '2' in predicted_text:
                predicted_text = predicted_text.replace('2', 'z')

        predicted_text = re.sub(r'[^a-zA-Z]', '-', predicted_text)[:1]  # กรองเฉพาะตัวอักษร

    elif label == "choice" and box_index is not None:
        num_x = x_image(roi)
        # ตรวจสอบว่ามีตัวอักษรในภาพหรือไม่
        if num_x > 0:
            # ใช้ TrOCR ทำนายเมื่อพบ X หรืออาจแก้เงื่อนไขตามต้องการ
            generated_ids = base_trocr_model.generate(pixel_values, max_new_tokens=6)
            predicted_text = base_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            #print(f"Original predicted_text: '{predicted_text}'")  # Debugging

            # กรองให้เหลือเฉพาะ 'x', 'X', 'y', 'Y'
            filtered_text = ''.join(re.findall(r'[xXyY]', predicted_text))

            # เก็บเฉพาะตัวอักษรตัวแรกที่ตรงเงื่อนไข (ถ้ามี)
            predicted_text = filtered_text[:1] if filtered_text else ' '  # หากไม่มีตัวอักษรเหลือ ให้ใช้ค่าว่าง

            #print(f"filtered predicted_text: '{predicted_text}'")  # Debugging

            #choices = ["A", "B", "C", "D", "E"]
            #predicted_text = choices[box_index]  
            # สมมติถ้าพบ 'xX' ก็ให้ return choices[box_index]
            if re.search(r'[xXyY]', predicted_text):
                choices = ["A", "B", "C", "D", "E"]
                predicted_text = choices[box_index]  
            else:
                predicted_text = ""
                #print("ไม่ใช่ x")
        else:
            # ถ้าไม่มีตัวอักษรในภาพ ให้ predicted_text เป็นค่าว่าง
            predicted_text = ""
            #print("ไม่เจอ")


    return predicted_text


def predict(sheets, subject, page, socketio):
    global stop_flag 
     
    # Loop ผ่าน array sheets และแสดงค่าตามที่ต้องการ
    for i, sheet_id in enumerate(sheets):
        if stop_flag:
            print(f"Stop flag = True และยังไม่ได้เชื่อมต่อ DB => หยุดลูปทันที i={i}")
            break

        paper = sheet_id

        # โหลด JSON
        json_path = f'./{subject}/positions/positions_{page}.json'
        with open(json_path, 'r') as file:
            positions = json.load(file)

        # อ่านรูปภาพ
        image_path = f"./{subject}/predict_img/{page}/{paper}.jpg"
        image = cv2.imread(image_path)

        if image is None:
            print(f"Error: Cannot read image {image_path}")
            continue
 
        #print(f"Loaded JSON from: {json_path}")
        #print(f"Image path: {image_path}")
        
        # ขนาดมาตรฐานของกระดาษ A4
        width, height = 2480, 3508
        image = cv2.resize(image, (width, height))

        # เตรียมภาพ
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)

        # ค้นหา Contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # ฟิลเตอร์ Contour ล่วงหน้า
        filtered_contours = [
            cv2.boundingRect(c)
            for c in contours
            if (cv2.boundingRect(c)[2] > 90 and cv2.boundingRect(c)[3] > 110)
        ]

        # ฟังก์ชันคำนวณพื้นที่ซ้อนทับ
        def calculate_overlap(box1, box2):
            x1 = max(box1[0], box2[0])
            y1 = max(box1[1], box2[1])
            x2 = min(box1[2], box2[2])
            y2 = min(box1[3], box2[3])

            # คำนวณพื้นที่ซ้อนทับ
            overlap_width = max(0, x2 - x1)
            overlap_height = max(0, y2 - y1)
            return overlap_width * overlap_height
        
        # บันทึกผลลัพธ์
        predictions = {}

        # วนลูปใน JSON
        for key, value in positions.items():
            prediction_list = []  # สำหรับเก็บผลการพยากรณ์
            padding = 12  # จำนวนพิกเซลที่ต้องการลบจากแต่ละด้าน

            # ตรวจสอบว่า value เป็น dictionary และมี key "label"
            if isinstance(value, dict) and "label" in value:
                label = value["label"]
                
                # ถ้า label เป็น "line" ให้เก็บค่า None ใน predictions[key]
                if label == "line":
                    predictions[key] = None
                    continue  # ข้ามการพยากรณ์

            if isinstance(value, list):  # กรณี studentID
                for item in value:
                    if stop_flag:
                        print(f"Stop flag studentID")
                        break

                    box_json = item["position"]
                    label = item["label"]

                    if label == "id":
                        max_overlap = 0
                        selected_contour = None

                        # ค้นหา Contour ที่มีการซ้อนทับมากที่สุด
                        for box_contour in filtered_contours[:]:  # ใช้สำเนาของ filtered_contours
                            x, y, w, h = box_contour
                            contour_box = [x, y, x + w, y + h]

                            # คำนวณพื้นที่ซ้อนทับ
                            overlap = calculate_overlap(box_json, contour_box)
                            if overlap > max_overlap:
                                max_overlap = overlap
                                selected_contour = box_contour

                        # ใช้ Contour ที่มีการซ้อนทับมากที่สุด
                        if selected_contour and max_overlap > 0:  # ซ้อนทับบางส่วน
                            # ลบ selected_contour ออกจาก filtered_contours
                            if selected_contour in filtered_contours:
                                filtered_contours.remove(selected_contour)
                            else:
                                print(f"Contour {selected_contour} ไม่พบใน filtered_contours")

                            x1, y1, w, h = selected_contour
                            x2, y2 = x1 + w, y1 + h

                            # ปรับ x1, y1, x2, y2 ให้ลบขอบ
                            x1 = max(x1 + padding, 0)
                            y1 = max(y1 + padding, 0)
                            x2 = min(x2 - padding, image.shape[1])
                            y2 = min(y2 - padding, image.shape[0])
                            
                             # ตรวจสอบความกว้าง/สูงของ ROI ไม่ให้เกิน box_json
                            json_width = box_json[2] - box_json[0]
                            json_height = box_json[3] - box_json[1]

                            roi_width = x2 - x1
                            roi_height = y2 - y1

                            # ถ้า ROI กว้างกว่าที่ JSON ระบุ ให้ลดลง
                            if roi_width > json_width:
                                x2 = x1 + json_width
                            # ถ้า ROI สูงกว่าที่ JSON ระบุ ให้ลดลง
                            if roi_height > json_height:
                                y2 = y1 + json_height

                            # หลังปรับแล้ว อย่าลืมเช็ค boundary ของรูป
                            x2 = min(x2, image.shape[1])
                            y2 = min(y2, image.shape[0])
                            
                            roi = image[y1:y2, x1:x2]
                            if roi.size > 0:
                                # แสดง ROI
                                #cv2_imshow(roi)

                                # แปลง ROI และพยากรณ์
                                roi_pil = Image.fromarray(cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)).convert("RGB")
                                pixel_values = large_processor(roi_pil, return_tensors="pt").pixel_values
                                predicted_text = perform_prediction(pixel_values, label)
                                prediction_list.append(predicted_text)

                                # วาดกรอบและแสดงข้อความ
                                # cv2.rectangle(image, (x1, y1), (x2, y2), (255, 0, 0), 2)
                                # cv2.putText(image, predicted_text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 2.0, (255, 0, 0), 2)
                                # print(f"Predicted text for key {key}: {predicted_text}")

                # เก็บคำตอบทั้งหมดใน key
                predictions[key] = ''.join(prediction_list)

            # ตรวจสอบกรณีที่ 2 - value เป็น dictionary ที่มี position และ label
            elif isinstance(value, dict) and 'position' in value and isinstance(value['position'], list):
                label = value['label']

                if isinstance(value['position'][0], list):  # หาก position เป็น list ของ list
                    prediction_list = []  # สำหรับเก็บผลลัพธ์ทั้งหมดใน key

                    for idx, box_json in enumerate(value['position']):
                        if stop_flag:
                            print(f"Stop flag list list")
                            break
                        
                        max_overlap = 0
                        selected_contour = None

                        for box_contour in filtered_contours[:]:  # ใช้สำเนา filtered_contours เพื่อตรวจสอบ Contour ที่เหลือ
                            x, y, w, h = box_contour
                            contour_box = [x, y, x + w, y + h]

                            # คำนวณพื้นที่ซ้อนทับ
                            overlap = calculate_overlap(box_json, contour_box)
                            if overlap > max_overlap:
                                max_overlap = overlap
                                selected_contour = box_contour

                        # ใช้ Contour ที่มีการซ้อนทับมากที่สุด
                        if selected_contour and max_overlap > 0:
                            filtered_contours.remove(selected_contour)  # ลบ Contour ที่ใช้แล้วออก
                            x1, y1, w, h = selected_contour
                            x2, y2 = x1 + w, y1 + h

                            # ปรับ x1, y1, x2, y2 ให้ลบขอบ
                            x1 = max(x1 + padding, 0)
                            y1 = max(y1 + padding, 0)
                            x2 = min(x2 - padding, image.shape[1])
                            y2 = min(y2 - padding, image.shape[0])
                            
                            json_width = box_json[2] - box_json[0]
                            json_height = box_json[3] - box_json[1]

                            roi_width = x2 - x1
                            roi_height = y2 - y1

                            if roi_width > json_width:
                                x2 = x1 + json_width
                            if roi_height > json_height:
                                y2 = y1 + json_height

                            x2 = min(x2, image.shape[1])
                            y2 = min(y2, image.shape[0])
                            
                            roi = image[y1:y2, x1:x2]
                            if roi.size > 0:
                                # แสดง ROI
                                #cv2_imshow(roi)

                                # แปลง ROI และพยากรณ์
                                roi_pil = Image.fromarray(cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)).convert("RGB")
                                pixel_values = large_processor(roi_pil, return_tensors="pt").pixel_values
                                predicted_text = perform_prediction(pixel_values, label, roi, box_index=idx)
                                # cv2.rectangle(image, (x1, y1), (x2, y2), (255, 0, 0), 2)
                                # cv2.putText(image, predicted_text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 2.0, (255, 0, 0), 2)
                                # print(f"Predicted text for key {key}, box {idx}: {predicted_text}")

                                # เก็บผลลัพธ์ใน prediction_list
                                prediction_list.append(predicted_text)

                    # เก็บคำตอบทั้งหมดใน key
                    predictions[key] = ''.join(prediction_list)


                else:  # หาก position เป็น list เดี่ยว
                    box_json = value['position']
                    max_overlap = 0
                    selected_contour = None

                    for box_contour in filtered_contours[:]:  # ใช้สำเนา filtered_contours เพื่อตรวจสอบ Contour ที่เหลือ
                        if stop_flag:
                            print(f"Stop flag list")
                            break

                        x, y, w, h = box_contour
                        contour_box = [x, y, x + w, y + h]

                        # คำนวณพื้นที่ซ้อนทับ
                        overlap = calculate_overlap(box_json, contour_box)
                        if overlap > max_overlap:
                            max_overlap = overlap
                            selected_contour = box_contour

                    # ใช้ Contour ที่มีการซ้อนทับมากที่สุด
                    if selected_contour and max_overlap > 0:
                        filtered_contours.remove(selected_contour)  # ลบ Contour ที่ใช้แล้วออก
                        x1, y1, w, h = selected_contour
                        x2, y2 = x1 + w, y1 + h

                        # ปรับ x1, y1, x2, y2 ให้ลบขอบ
                        x1 = max(x1 + padding, 0)
                        y1 = max(y1 + padding, 0)
                        x2 = min(x2 - padding, image.shape[1])
                        y2 = min(y2 - padding, image.shape[0])
                        
                        json_width = box_json[2] - box_json[0]
                        json_height = box_json[3] - box_json[1]

                        roi_width = x2 - x1
                        roi_height = y2 - y1

                        if roi_width > json_width:
                            x2 = x1 + json_width
                        if roi_height > json_height:
                            y2 = y1 + json_height

                        x2 = min(x2, image.shape[1])
                        y2 = min(y2, image.shape[0])
                        
                        roi = image[y1:y2, x1:x2]
                        if roi.size > 0:
                            # แสดง ROI
                            #cv2_imshow(roi)

                            # แปลง ROI และพยากรณ์
                            roi_pil = Image.fromarray(cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)).convert("RGB")
                            pixel_values = large_processor(roi_pil, return_tensors="pt").pixel_values
                            predicted_text = perform_prediction(pixel_values, label, roi)
                            # cv2.rectangle(image, (x1, y1), (x2, y2), (255, 0, 0), 2)
                            # cv2.putText(image, predicted_text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 2.0, (255, 0, 0), 2)
                            # print(f"Predicted text for key {key}: {predicted_text}")

                            # บันทึกผลลัพธ์
                            predictions[key] = predicted_text


        #print("\n===== Final Predictions =====")
        #for key, value in predictions.items():
        #    print(f"Key {key}: {value}")

        #------------------------ ADD DB --------------------------------
        # 2) ก่อนเริ่มเขียน DB เช็ค stop_flag อีกรอบ (เผื่อกรณีเพิ่งถูกสั่งหยุด)
        if stop_flag:
            print(f"Stop flag = True (ยังไม่ได้ต่อ DB) => หยุดลูป i={i}")
            break
         
        conn = get_db_connection()  # ฟังก์ชันสำหรับสร้างการเชื่อมต่อกับฐานข้อมูล
        cursor = conn.cursor()

        for key, value in predictions.items():
            if key == "studentID":
                # อัปเดต `Id_predict` ใน `Exam_sheet`
                update_exam_sheet_query = """
                    UPDATE Exam_sheet
                    SET Id_predict = %s
                    WHERE Sheet_id = %s;
                """
                cursor.execute(update_exam_sheet_query, (value, paper))
                #print(f"Key studentID: {value}")
            else:
                # ค้นหา label_id จากตาราง label
                find_label_query = """
                    SELECT Label_id
                    FROM Label
                    WHERE No = %s AND Subject_id = %s;
                """
                cursor.execute(find_label_query, (key, subject))

                ans_label = cursor.fetchone()

                if ans_label:
                    ans_label_id = ans_label[0]  # ดึง label_id

                    # แทรกข้อมูลลงตาราง Answer
                    insert_answer_query = """
                        INSERT INTO Answer (Label_id, Modelread, Sheet_id)
                        VALUES (%s, %s, %s);
                    """
                    cursor.execute(insert_answer_query, (ans_label_id, value, paper))
                    #print(f"Key {key}: {value}")
                else:
                    print(f"Label No {key} ไม่พบในฐานข้อมูล")

        # คอมมิตการเปลี่ยนแปลง
        conn.commit()
        print("การบันทึกข้อมูลเสร็จสิ้น")
        
        # ปิดการเชื่อมต่อ
        cursor.close()
        conn.close()

        cal_score(paper, socketio)
        # หลัง cal_score เสร็จ ให้บังคับส่ง event ทันที
        socketio.sleep(0.1)  # หรือ 0


 
def cal_score(paper, socketio):
    # เชื่อมต่อกับฐานข้อมูล
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Query ข้อมูล Answer ที่ตรงกับ Sheet_id
    query_answers = '''
        SELECT *
        FROM Answer
        WHERE Sheet_id = %s
    '''
    cursor.execute(query_answers, (paper,))
    answer_records = cursor.fetchall()

    if not answer_records:
        print("No records found for the specified paper ID.")
        return 



    # Query ดึงข้อมูล Answer, label และ Group_Point
    query = '''
        SELECT a.Ans_id, a.Label_id, a.Modelread, l.Answer, l.Point_single, l.Group_no, gp.Point_group, l.Type, a.Score_point
        FROM Answer a
        JOIN Label l ON a.Label_id = l.Label_id
        LEFT JOIN Group_point gp ON l.Group_no = gp.Group_no
        WHERE a.Sheet_id = %s
    '''
    cursor.execute(query, (paper,))
    answers = cursor.fetchall()

    #print(f"Number of answers fetched: {len(answers)}")
    if not answers:
        print(f"No answers found for Sheet_id: {paper}")
        return
    
    sum_score = 0
    group_answers = {}
    checked_groups = set()

    # เก็บข้อมูลคำตอบแบบกลุ่ม
    group_answers = {}
    for row in answers:
        group_no = row['Group_no']
        if group_no is not None:
            if group_no not in group_answers:
                group_answers[group_no] = []
            modelread_lower = row['Modelread'].lower() if row['Modelread'] else ''
            answer_lower = row['Answer'].lower() if row['Answer'] else ''
            group_answers[group_no].append((modelread_lower, answer_lower, row['Point_group']))

    # ตรวจสอบและคำนวณคะแนน
    for row in answers:
        modelread_lower = row['Modelread'].lower() if row['Modelread'] else ''
        answer_lower = row['Answer'].lower() if row['Answer'] else ''
        score_point = 0
        
         # ตรวจสอบ type == 'free'
        if row['Type'] == 'free':
            if row['Point_single'] is not None:
                score_point = row['Point_single']
                sum_score += row['Point_single']
            elif row['Group_no'] is not None and row['Group_no'] not in checked_groups:
                point_group = row['Point_group']
                if point_group is not None:
                    sum_score += point_group
                    checked_groups.add(row['Group_no'])
            print(f"Ans_id {row['Ans_id']} (free): Added {score_point} points.")
            continue

        if row['Type'] == '6':
            score_point = 0  # กำหนด Score_point เป็น 0 เสมอ
            #print(f"Ans_id {row['Ans_id']} (type 6): Score set to {score_point}.")
            update_answer_query = '''
                UPDATE Answer
                SET Score_point = %s
                WHERE Ans_id = %s
            '''
            cursor.execute(update_answer_query, (score_point, row['Ans_id']))
            continue

        # ตรวจสอบคำตอบเดี่ยว
        if modelread_lower == answer_lower and row['Point_single'] is not None:
            score_point = row['Point_single']
            sum_score += row['Point_single']
            print(f"Ans_id {row['Ans_id']}: Single point added {score_point}.")

        # ตรวจสอบคำตอบแบบกลุ่ม
        group_no = row['Group_no']
        if group_no is not None and group_no not in checked_groups:
            all_correct = all(m == a for m, a, _ in group_answers[group_no])
            if all_correct:
                point_group = row['Point_group']
                if point_group is not None:
                    sum_score += point_group
                    checked_groups.add(group_no)
                    print(f"Group_no {group_no}: Group point added {point_group}.")

        # อัปเดตคะแนนของแต่ละข้อใน Answer.score_point
        update_answer_query = '''
            UPDATE Answer
            SET Score_point = %s
            WHERE Ans_id = %s
        '''
        cursor.execute(update_answer_query, (score_point, row['Ans_id']))


    # Update คะแนนในตาราง Exam_sheet
    update_query = '''
        UPDATE Exam_sheet
        SET Score = %s
        WHERE Sheet_id = %s
    '''
    cursor.execute(update_query, (sum_score, paper))
    conn.commit()
    print(f"Updated total score: {sum_score} for Sheet_id: {paper}")

    # ปิดการเชื่อมต่อ
    cursor.close()
    conn.close()

    # ส่ง event ไปยัง Frontend
    socketio.emit('score_updated', {'message': 'Score updated for one paper'})