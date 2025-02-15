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
from transformers import TrOCRProcessor, VisionEncoderDecoderModel, DonutProcessor 
from PIL import Image
import re  
import easyocr  
import requests
import stop_flag  # นำเข้า stop_flag

import ssl
ssl._create_default_https_context = ssl._create_unverified_context


# ตรวจสอบ GPU ที่มีอยู่และตั้งค่า device
if torch.cuda.is_available() and torch.cuda.device_count() > 0:
    device = "cuda"  # ใช้ CUDA GPU
elif torch.backends.mps.is_available():
    device = "mps"  # ใช้ MPS GPU (สำหรับ Apple Silicon)
else:
    device = "cpu"  # ใช้ CPU

# โหลดโมเดลเพียงครั้งเดียว
print("Loading models...")

print("Loading Donut model...")
donut_processor = DonutProcessor.from_pretrained("./models/OCR-Donut-CORD")
donut_model = VisionEncoderDecoderModel.from_pretrained("./models/OCR-Donut-CORD").to(device)
 
# โหลดโมเดล TrOCR ครั้งเดียว
print("Loading TrOCR models...")
large_processor = TrOCRProcessor.from_pretrained("./models/trocr-large-handwritten/processor")
large_trocr_model = VisionEncoderDecoderModel.from_pretrained(
    "./models/trocr-large-handwritten/model",
    torch_dtype=torch.float16 if device in ["mps", "cuda"] else torch.float32
).to(device)

base_processor = TrOCRProcessor.from_pretrained("./models/trocr-large-handwritten/processor")
base_trocr_model = VisionEncoderDecoderModel.from_pretrained(
    "./models/trocr-base-handwritten/model",
    torch_dtype=torch.float16 if device in ["mps", "cuda"] else torch.float32
).to(device)

print("Models loaded successfully!")

#----------------------- convert img ----------------------------
def filter_corners(detected_boxes, image_width, image_height):
    corners = {"top_left": None, "top_right": None, "bottom_left": None, "bottom_right": None}
    min_distances = {"top_left": float('inf'), "top_right": float('inf'), "bottom_left": float('inf'), "bottom_right": float('inf')}

    for box in detected_boxes:
        x1, y1, x2, y2 = box
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2  # ศูนย์กลางของกล่อง

        # คำนวณระยะห่างจากแต่ละมุม
        dist_top_left = cx**2 + cy**2
        dist_top_right = (image_width - cx)**2 + cy**2
        dist_bottom_left = cx**2 + (image_height - cy)**2
        dist_bottom_right = (image_width - cx)**2 + (image_height - cy)**2

        # อัปเดตกล่องที่ใกล้แต่ละมุมที่สุด
        if dist_top_left < min_distances["top_left"]:
            min_distances["top_left"] = dist_top_left
            corners["top_left"] = box
        if dist_top_right < min_distances["top_right"]:
            min_distances["top_right"] = dist_top_right
            corners["top_right"] = box
        if dist_bottom_left < min_distances["bottom_left"]:
            min_distances["bottom_left"] = dist_bottom_left
            corners["bottom_left"] = box
        if dist_bottom_right < min_distances["bottom_right"]:
            min_distances["bottom_right"] = dist_bottom_right
            corners["bottom_right"] = box

    # คืนค่าเฉพาะกล่องที่พบ
    return [corners[key] for key in ["bottom_right", "bottom_left", "top_right", "top_left"] if corners[key] is not None]
    

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


def convert_pdf(pdf_buffer, subject_id, page_no):
    try:
        # เชื่อมต่อฐานข้อมูล
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. ค้นหา Page_id จาก Subject_id และ Page_no
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
            pix = page.get_pixmap(dpi=300)  # ใช้ DPI สูงเพื่อความคมชัด
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

            # แปลงภาพเป็นรูปแบบที่ OpenCV ใช้งานได้
            if pix.n == 4:  # ตรวจสอบว่ามีช่อง Alpha หรือไม่
                img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
            else:
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
                
            # ขนาดมาตรฐานของกระดาษ A4
            width, height = 2480, 3508
            img_resized = cv2.resize(img, (width, height))

            # เปลี่ยนเป็นสีเทาและ Threshold
            gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)

            # ค้นหา Contours
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

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

        # ดึงข้อมูล Page_id และ Page_no จากฐานข้อมูลตาม Subject ID
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
            pix = page.get_pixmap(dpi=300)  # ใช้ DPI สูงเพื่อความคมชัด
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

            # แปลงภาพเป็นรูปแบบที่ OpenCV ใช้งานได้
            if pix.n == 4:  # ตรวจสอบว่ามีช่อง Alpha หรือไม่
                img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
            else:
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

            # ขนาดมาตรฐานของกระดาษ A4
            width, height = 2480, 3508
            img_resized = cv2.resize(img, (width, height))

            # เปลี่ยนเป็นสีเทาและ Threshold
            gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)

            # ค้นหา Contours
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

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

    # ค้นหา Page_id ที่ตรงกับ Subject_id และ Page_no
    page_query = """
        SELECT Page_id 
        FROM Page 
        WHERE Subject_id = %s AND Page_no = %s
    """
    cursor.execute(page_query, (subject, page))
    result = cursor.fetchone()

    if result:
        page_id = result[0]

        # ค้นหา Sheet_id ที่ Score เป็น NULL และ Page_id ตรงกัน
        exam_sheet_query = """
            SELECT Sheet_id 
            FROM Exam_sheet 
            WHERE Page_id = %s AND Score IS NULL
        """
        cursor.execute(exam_sheet_query, (page_id,))
        sheets = [row[0] for row in cursor.fetchall()]

        # แสดงค่าใน array sheets
        print(f"Sheet IDs with NULL Score for Page_id {page_id}: {sheets}")

        # ปิดการเชื่อมต่อฐานข้อมูล
        cursor.close()
        conn.close()

        # เรียกฟังก์ชัน predict ด้วย array sheets, subject, page
        predict(sheets, subject, page, socketio)

    else:
        print(f"No Page found for Subject_id: {subject}, Page_no: {page}")
        cursor.close()
        conn.close()

def normalize_predict(text):
    replace_dict = {
        'B': '6', 'b': '6',
        'O': '0', 'o': '0',
        'L': '1', 'l': '1',
        'I': '1', 'i': '1',
        'A': '9', 'a': '9',
        'Z': '2', 'z': '2',
        'G': '9', 'g': '9',
        'S': '5', 's': '5',
        'Y': '4', 'y': '4',
        'U': '4', 'u': '4',
        'Q': '9', 'q': '9',
        'F': '4', 'f': '4'
    }

    for char, replacement in replace_dict.items():
        text = text.replace(char, replacement)

    # กรองเฉพาะตัวเลขและแทนที่ตัวอักษรที่ไม่ใช่ตัวเลขด้วย "-"
    text = re.sub(r'\D', '-', text)[:1]

    return text
 

def detect_mark_in_roi(roi):
    # แปลงเป็นขาวดำ
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    # ใช้ Adaptive Threshold หรือ Otsu Threshold
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # หาขอบเขตของเครื่องหมาย
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)


    # นับจำนวนเส้นและคำนวณพื้นที่รวมของเส้น
    total_contours = len(contours)
    total_area = sum(cv2.contourArea(cnt) for cnt in contours)

    #print(f"Total contours: {total_contours}, Total area: {total_area}")

    # ตรวจจับเส้นโดยใช้ Hough Line Transform
    edges = cv2.Canny(gray, 50, 150)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 30, minLineLength=20, maxLineGap=5)
    total_lines = len(lines) if lines is not None else 0

    #print(f"Total lines detected: {total_lines}")

    # ตรวจจับจุดตัดของเส้นโดยใช้ Harris Corner Detection
    dst = cv2.cornerHarris(np.float32(gray), 2, 3, 0.04)
    total_corners = np.sum(dst > 0.01 * dst.max())

    #print(f"Total corners detected: {total_corners}")

    # ตั้งค่าเกณฑ์กรอง noise และเส้นที่ซับซ้อนเกินไป
    max_contours = 30   # ถ้ามีเส้นมากกว่านี้อาจเป็นลายเซ็น
    min_area = 250
    max_area = 6500     # ถ้าพื้นที่รวมของเส้นใหญ่เกินไปอาจเป็นลายเซ็น
    max_lines = 20      # ถ้ามีเส้นเยอะเกินไป อาจเป็นขีดเขียนมั่ว
    min_corners = 250
    max_corners = 800 #150 goodnote    # ถ้ามีจุดตัดเยอะมาก อาจเป็นลายเซ็น

    # Debugging
    if total_contours > max_contours:
        #print("❌ Too many contours, skipping")
        return False
    if total_area < min_area:
        #print("❌ Area too small, skipping")
        return False
    if total_area > max_area:
        #print("❌ Area too large, skipping")
        return False
    if total_lines > max_lines:
        #print("❌ Too many lines, skipping")
        return False
    if total_corners < min_corners:
        #print("❌ Too few corners, skipping")
        return False
    if total_corners > max_corners:
        #print("❌ Too many corners, skipping")
        return False

    # กำหนดค่าพื้นฐานของเงื่อนไข เช่น ถ้ามีจุดตัดมากอาจเป็น X
    mark_detected = False

    for cnt in contours:
        area = cv2.contourArea(cnt)
        #print(f"Area = {area}")
        if area > 50:  # กำหนดค่าขั้นต่ำเพื่อกรอง noise
            # หาค่าความโค้งของรูปร่าง
            approx = cv2.approxPolyDP(cnt, 0.02 * cv2.arcLength(cnt, True), True)
            #print(f"Contour {idx}: Points = {len(approx)}")
            if len(approx) >= 4:  # ถ้ามีจุดมากพอ อาจเป็น X หรือ Y
                mark_detected = True
                #print("✅ Detected ")
                break  # ถ้าพบแล้วก็หยุดทันที

    return mark_detected

def preprocess_image(roi):
    # ตัดขอบรบกวน (Crop margins)
    roi = roi[10:roi.shape[0] - 10, 10:roi.shape[1] - 10]

    # แปลงเป็น Grayscale
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    # เพิ่ม Contrast โดยใช้ CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # ลบรอยเปื้อนและลด Noise ด้วย Gaussian Blur
    denoised = cv2.GaussianBlur(enhanced, (5, 5), 0)

    # Adaptive Thresholding เพื่อให้ข้อความคมขึ้น
    processed = cv2.adaptiveThreshold(
        denoised, 
        255, 
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 
        15, 
        10
    )

    # ใช้ Morphological Opening เพื่อลบ noise เล็ก ๆ (จุดดำเล็ก)
    kernel = np.ones((2, 2), np.uint8)
    noise_removed = cv2.morphologyEx(processed, cv2.MORPH_OPEN, kernel, iterations=3)
 
    # แสดง noise_removed เพื่อดูคอนทัวร์และค่า area
    #cv2_imshow(noise_removed)

    # ใช้ Morphological Closing เพื่อเติมจุดขาดหายเล็ก ๆ ของตัวอักษร
    closed = cv2.morphologyEx(noise_removed, cv2.MORPH_CLOSE, kernel, iterations=3)
 
    # แสดงภาพที่ผ่านกระบวนการสุดท้าย
    #cv2_imshow(closed)

    # แปลงกลับเป็นรูปภาพของ PIL
    return Image.fromarray(closed).convert("RGB")

def extract_deepest_value(text):
    """ ค้นหาค่าจากแท็กที่อยู่ลึกที่สุด โดยให้เลือกแท็กที่มีคำว่า 'total_price' ก่อน ถ้าไม่มีให้เลือกแท็กที่มีคำว่า 'nm' """
    
    # ค้นหาแท็ก 'total_price' ที่อยู่ลึกที่สุด
    total_price_match = re.search(r"<([^<>]*total_price[^<>]*)>([^<>]+)</\1>(?!.*<\1>)", text)
    if total_price_match:
        return total_price_match.group(2)  # คืนค่าภายในแท็กที่มี 'total_price'

    # ถ้าไม่มี 'total_price' ให้ค้นหาแท็ก 'nm' ที่อยู่ลึกที่สุด
    nm_match = re.search(r"<([^<>]*nm[^<>]*)>([^<>]+)</\1>(?!.*<\1>)", text)
    if nm_match:
        return nm_match.group(2)  # คืนค่าภายในแท็กที่มี 'nm'

    # ถ้าไม่มี 'total_price' และ 'nm' ให้เลือกแท็กสุดท้ายที่มีอยู่
    match = re.search(r"<([^<>]+)>([^<>]+)</\1>(?!.*<\1>)", text)
    if match:
        return match.group(2)  # คืนค่าภายในแท็กที่อยู่ลึกที่สุดที่เหลือ

    return "-"



def perform_prediction(pixel_values, label, roi=None, box_index=None):

    # ย้าย pixel_values ไปยัง MPS
    pixel_values = pixel_values.to(device)

    # พยากรณ์สำหรับ label
    if label == "sentence":
        if roi is not None:
            # ปรับแต่งภาพก่อนพยากรณ์
            roi_image = preprocess_image(roi)

            #count = predict_image(roi_image)

            # เตรียมข้อมูลสำหรับโมเดล OCR-Donut
            inputs = donut_processor(images=roi_image, return_tensors="pt").to(device)

            # พยากรณ์ข้อความ
            with torch.no_grad():
                generated_ids = donut_model.generate(**inputs, max_length=50)

            # แปลงผลลัพธ์เป็นข้อความ
            full_predicted_text = donut_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            #print(f"{full_predicted_text}")

            # ดึงค่าเฉพาะจากแท็กที่ลึกที่สุด
            predicted_text = extract_deepest_value(full_predicted_text)

            #print(f"{predicted_text}")

            # ลบแท็กที่อาจหลงเหลืออยู่
            predicted_text = re.sub(r"<.*?>", "", predicted_text).strip()

            # กรองให้เหลือเฉพาะตัวเลข ./
            predicted_text = re.sub(r"[^0-9./]", "", predicted_text)

            # ลบ ., / ถ้าหน้าหรือหลังมีตัวอักษรที่ไม่ใช่ตัวเลข
            predicted_text = re.sub(r"(?<!\d)[./]|[./](?!\d)", "", predicted_text)

        else:
            print("Error: ROI is not provided for sentence prediction.")
            predicted_text = "-"



    elif label == "id":
        generated_ids = large_trocr_model.generate(pixel_values, max_new_tokens=3)
        predicted_text = large_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

        predicted_text = normalize_predict(predicted_text)    

        #print(f"filtered predicted_text: '{predicted_text}'")  # Debugging
        # กรองเฉพาะตัวเลข
        #predicted_text = re.sub(r'\D', '-', predicted_text)[:1]

    elif label == "number":
        generated_ids = base_trocr_model.generate(pixel_values, max_new_tokens=3)
        predicted_text = base_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

        predicted_text = normalize_predict(predicted_text)

        # กรองเฉพาะตัวเลข
        #predicted_text = re.sub(r'\D', '-', predicted_text)[:1]

    elif label == "character":
        generated_ids = large_trocr_model.generate(pixel_values, max_new_tokens=3)
        predicted_text = large_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

        if '0' in predicted_text:
            predicted_text = predicted_text.replace('0', 'o')
        if '2' in predicted_text:
            predicted_text = predicted_text.replace('2', 'z')
        if '9' in predicted_text:
            predicted_text = predicted_text.replace('9', 'g')
        if '6' in predicted_text:
            predicted_text = predicted_text.replace('6', 'b')
        if '1' in predicted_text:
            predicted_text = predicted_text.replace('1', 'i')
        if '5' in predicted_text:
            predicted_text = predicted_text.replace('5', 's')

        predicted_text = re.sub(r'[^a-zA-Z]', '-', predicted_text)[:1]  # กรองเฉพาะตัวอักษร

    elif label == "choice" and box_index is not None:
        if detect_mark_in_roi(roi):
            choices = ["A", "B", "C", "D", "E"]
            predicted_text = choices[box_index]
        else:
            # ถ้าไม่มีตัวอักษรในภาพ ให้ predicted_text เป็นค่าว่าง
            predicted_text = ""
            #print("ไม่เจอ")


    return predicted_text


def predict(sheets, subject, page, socketio):

    # Loop ผ่าน array sheets และแสดงค่าตามที่ต้องการ
    for i, sheet_id in enumerate(sheets):
        if stop_flag.stop_flag:  # เช็คค่า stop_flag แบบ real-time
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
                    if stop_flag.stop_flag:  # เช็คค่า stop_flag แบบ real-time
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

                            # -----------------------------
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
                            # -----------------------------

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
                        if stop_flag.stop_flag:  # เช็คค่า stop_flag แบบ real-time
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

                            # -----------------------------
                            # ตรวจสอบความกว้าง/สูงของ ROI ไม่ให้เกิน box_json
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
                            # -----------------------------

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
                        if stop_flag.stop_flag:  # เช็คค่า stop_flag แบบ real-time
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

                        # -----------------------------
                        # ตรวจสอบความกว้าง/สูงของ ROI ไม่ให้เกิน box_json
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
                        # -----------------------------

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
        if stop_flag.stop_flag:  # เช็คค่า stop_flag แบบ real-time
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
                # ค้นหา Label_id จากตาราง Label
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

    # Query ดึงข้อมูล Answer, Label และ Group_Point
    query = '''
        SELECT a.Ans_id, a.Label_id, a.Modelread, l.Answer, l.Point_single, l.Group_No, gp.Point_Group, l.Type, a.Score_point
        FROM Answer a
        JOIN Label l ON a.Label_id = l.Label_id
        LEFT JOIN Group_Point gp ON l.Group_No = gp.Group_No
        WHERE a.Sheet_id = %s
    '''
    cursor.execute(query, (paper,))
    answers = cursor.fetchall()

    if not answers:
        print(f"No answers found for Sheet_id: {paper}")
        return

    sum_score = 0
    group_answers = {}
    checked_groups = set()

    # เก็บข้อมูลคำตอบแบบกลุ่ม
    for row in answers:
        group_no = row['Group_No']
        if group_no is not None:
            if group_no not in group_answers:
                group_answers[group_no] = []
            modelread_lower = row['Modelread'].lower() if row['Modelread'] else ''
            answer_lower = row['Answer'].lower() if row['Answer'] else ''
            group_answers[group_no].append((modelread_lower, answer_lower, row['Point_Group']))

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
            elif row['Group_No'] is not None and row['Group_No'] not in checked_groups:
                point_group = row['Point_Group']
                if point_group is not None:
                    sum_score += point_group
                    checked_groups.add(row['Group_No'])
            print(f"Ans_id {row['Ans_id']} (free): Added {score_point} points.")
            continue

        # ตรวจสอบ type == 6
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
        group_no = row['Group_No']
        if group_no is not None and group_no not in checked_groups:
            all_correct = all(m == a for m, a, _ in group_answers[group_no])
            if all_correct:
                point_group = row['Point_Group']
                if point_group is not None:
                    sum_score += point_group
                    checked_groups.add(group_no)
                    print(f"Group_No {group_no}: Group point added {point_group}.")

        # อัปเดตคะแนนใน Answer.score_point
        update_answer_query = '''
            UPDATE Answer
            SET Score_point = %s
            WHERE Ans_id = %s
        '''
        cursor.execute(update_answer_query, (score_point, row['Ans_id']))

    # Update คะแนนใน Exam_sheet
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
