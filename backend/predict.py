import fitz  # PyMuPDF for handling PDFs
import cv2
import numpy as np
import os
import sqlite3
from db import get_db_connection
import json
import torch
from transformers import TrOCRProcessor, VisionEncoderDecoderModel, DonutProcessor 
from PIL import Image
import re  
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
def detect_black_boxes(image):
    # แปลงภาพเป็น HSV
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # กำหนดช่วงสีดำใน HSV (สีดำจะมีค่า V (Value) ต่ำสุด)
    lower_black = np.array([0, 0, 0], dtype=np.uint8)        # เริ่มจากสีดำที่มีค่า S, V ต่ำ
    upper_black = np.array([180, 255, 50], dtype=np.uint8)   # ขีดจำกัดของสีดำ (Value ต่ำสุด)

    # สร้าง mask สำหรับสีดำ
    mask = cv2.inRange(hsv, lower_black, upper_black)

    # หาคอนทัวร์ใน mask
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    detected_boxes = []
    for contour in contours:
        # กรองคอนทัวร์ที่มีขนาดเล็กเกินไป
        x, y, w, h = cv2.boundingRect(contour)

        # กรองเฉพาะกล่องที่มีความกว้างและความสูงในช่วงที่ต้องการ
        if 40 < w < 160 and 40 < h < 160:  # เพิ่มช่วงขนาดที่ต้องการ
            cropped_image = mask[y:y+h, x:x+w]
            black_ratio = np.sum(cropped_image == 255) / cropped_image.size
            # วาดกรอบสี่เหลี่ยมรอบกล่องที่ตรวจพบ
            #cv2.rectangle(image, (x, y), (x + w, y + h), (0, 255, 0), 2)  # วาดกรอบสีเขียว

            # ตรวจสอบว่าด้านในของกล่องเป็นสีดำหรือไม่
            # ถ้าในกรอบของกล่องเป็นสีดำจริง ๆ จะทำการตรวจจับเพิ่ม
            if black_ratio > 0.4:
                detected_boxes.append((x, y, x + w, y + h))
                # cv2.rectangle(image, (x, y), (x + w, y + h), (0, 0, 255), 2)
    if not detected_boxes:
        print("[❌] No black boxes detected under current criteria.")
    else:
        print(f"[✅] Total detected black boxes: {len(detected_boxes)}")

    return image, detected_boxes


def filter_corners(detected_boxes, image_width, image_height):
    cx_img, cy_img = image_width // 2, image_height // 2

    # Increase the margins to capture more potential corners
    margin_x = image_width // 8  # More flexible margin
    margin_y = image_height // 8

    groups = {
        "top_left": [],
        "top_right": [],
        "bottom_left": [],
        "bottom_right": []
    }

    for box in detected_boxes:
        x1, y1, x2, y2 = box
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2

        # Calculate distances from each corner of the image
        dist_tl = (cx**2 + cy**2)
        dist_tr = ((image_width - cx)**2 + cy**2)
        dist_bl = (cx**2 + (image_height - cy)**2)
        dist_br = ((image_width - cx)**2 + (image_height - cy)**2)

        # More generous quadrant assignment - box can be in multiple quadrants
        if cx < cx_img and cy < cy_img:
            groups["top_left"].append((box, dist_tl))
        if cx > cx_img and cy < cy_img:
            groups["top_right"].append((box, dist_tr))
        if cx < cx_img and cy > cy_img:
            groups["bottom_left"].append((box, dist_bl))
        if cx > cx_img and cy > cy_img:
            groups["bottom_right"].append((box, dist_br))

    used_boxes = set()
    corners = {}

    # First pass: find the best box for each corner
    for corner in ["top_left", "top_right", "bottom_left", "bottom_right"]:
        if not groups[corner]:
            corners[corner] = None
            continue

        best_box = None
        min_dist = float("inf")
        for box, dist in groups[corner]:
            if dist < min_dist:
                min_dist = dist
                best_box = box

        if best_box:
            corners[corner] = best_box
            used_boxes.add(tuple(best_box))
        else:
            corners[corner] = None

    #print(f"Detected corners (quadrant-filtered): {corners}")
    return corners

def sort_corners(corner_boxes):
    corner_boxes = sorted(corner_boxes, key=lambda box: (box[1] + box[3]) / 2)
    top_boxes = corner_boxes[:2]
    bottom_boxes = corner_boxes[2:]

    # จัดเรียงแต่ละแถวตามค่า X
    top_boxes = sorted(top_boxes, key=lambda box: (box[0] + box[2]) / 2)
    bottom_boxes = sorted(bottom_boxes, key=lambda box: (box[0] + box[2]) / 2)

    return [
        bottom_boxes[1],  # bottom-right
        bottom_boxes[0],  # bottom-left
        top_boxes[1],     # top-right
        top_boxes[0],     # top-left
    ]


def convert_pdf(pdf_buffer, subject_id, page_no):
    try:
        # เชื่อมต่อฐานข้อมูล
        conn = get_db_connection()
        if conn is None:
            return {"success": False, "message": "Database connection failed"}

        conn.row_factory = sqlite3.Row  # ใช้ row_factory เพื่อเข้าถึงค่าผ่านชื่อคอลัมน์
        cursor = conn.cursor()

        # 1. ค้นหา Page_id จาก Subject_id และ Page_no
        cursor.execute("SELECT Page_id FROM Page WHERE Subject_id = ? AND Page_no = ?", (subject_id, page_no))
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

            # เรียกฟังก์ชันตรวจจับกล่องสีดำ
            img_with_boxes, detected_boxes = detect_black_boxes(img_resized)

            # ตรวจหามุมที่ตรวจพบ
            corners_dict = filter_corners(detected_boxes, img_resized.shape[1], img_resized.shape[0])

            # จัดลำดับมุม
            if corners_dict["top_left"] is not None and corners_dict["top_right"] is not None and corners_dict["bottom_left"] is not None and corners_dict["bottom_right"] is not None:
                sorted_boxes = sort_corners([
                    corners_dict["bottom_right"],
                    corners_dict["bottom_left"],
                    corners_dict["top_right"],
                    corners_dict["top_left"]
                ])

                # แปลงมุมมองของภาพ
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

                # 2. เพิ่มค่า Page_id ลงในตาราง Exam_sheet
                cursor.execute("INSERT INTO Exam_sheet (Page_id) VALUES (?)", (page_id,))
                conn.commit()

                # 3. เก็บค่า Sheet_id ที่เพิ่มไว้ในตัวแปร name
                sheet_id = cursor.lastrowid
                name = f"{sheet_id}"  # ตั้งชื่อเป็น Sheet_ID เช่น "1"

                # บันทึกภาพที่ปรับแล้ว
                output_path = os.path.join(folder_path, f"{name}.jpg")
                cv2.imwrite(output_path, resized_image)
                print(f"บันทึกภาพ: {output_path}")

            else:
                print(f"ไม่พบกล่องสี่เหลี่ยม 4 กล่องในหน้า {page_number + 1}")

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
        if conn is None:
            return {"success": False, "message": "Database connection failed"}

        conn.row_factory = sqlite3.Row  # ใช้ row_factory เพื่อเข้าถึงค่าผ่านชื่อคอลัมน์
        cursor = conn.cursor()

        # ดึงข้อมูล Page_id และ Page_no จากฐานข้อมูลตาม Subject ID
        cursor.execute("SELECT Page_id, Page_no FROM Page WHERE Subject_id = ?", (subject_id,))
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

            # เรียกฟังก์ชันตรวจจับกล่องสีดำ
            img_with_boxes, detected_boxes = detect_black_boxes(img_resized)

            # ตรวจหามุมที่ตรวจพบ
            corners_dict = filter_corners(detected_boxes, img_resized.shape[1], img_resized.shape[0])

            # จัดลำดับมุม
            if corners_dict["top_left"] is not None and corners_dict["top_right"] is not None and corners_dict["bottom_left"] is not None and corners_dict["bottom_right"] is not None:
                sorted_boxes = sort_corners([
                    corners_dict["bottom_right"],
                    corners_dict["bottom_left"],
                    corners_dict["top_right"],
                    corners_dict["top_left"]
                ])

                # แปลงมุมมองของภาพ
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

                # เพิ่มค่า Page_id ลงในตาราง Exam_sheet
                cursor.execute("INSERT INTO Exam_sheet (Page_id) VALUES (?)", (page_id,))
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

            else:
                print(f"ไม่พบกล่องสี่เหลี่ยม 4 กล่องในหน้า {page_number + 1}")

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
    if conn is None:
        print("Database connection failed")
        return

    cursor = conn.cursor()

    try:
        # ค้นหา Page_id ที่ตรงกับ Subject_id และ Page_no
        page_query = """
            SELECT Page_id 
            FROM Page 
            WHERE Subject_id = ? AND Page_no = ?
        """
        cursor.execute(page_query, (subject, page))
        result = cursor.fetchone()

        if result:
            page_id = result[0]

            # ค้นหา Sheet_id ที่ Id_predict เป็น NULL และ Page_id ตรงกัน
            exam_sheet_query = """
                SELECT Sheet_id 
                FROM Exam_sheet 
                WHERE Page_id = ? AND Id_predict IS NULL
            """
            cursor.execute(exam_sheet_query, (page_id,))
            sheets = [row[0] for row in cursor.fetchall()]

            # แสดงค่าใน array sheets
            print(f"Sheet IDs with NULL Id_predict for Page_id {page_id}: {sheets}")

            # เรียกฟังก์ชัน predict ด้วย array sheets, subject, page
            predict(sheets, subject, page, socketio)

        else:
            print(f"No Page found for Subject_id: {subject}, Page_no: {page}")

    except sqlite3.Error as e:
        print(f"Database error: {str(e)}")

    finally:
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
    text = re.sub(r'\D', ' ', text)[:1]

    return text
 

def detect_mark_in_roi(roi):
    """
    ตรวจสอบว่าใน ROI มีเครื่องหมายที่คล้าย X, /, หรือ Y หรือไม่
    และกรองภาพที่มี noise, รูปหยัก, หรือซับซ้อนเกินไป
    """
    import numpy as np
    import cv2

    # แปลงเป็น grayscale
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    # ✅ ตรวจว่าเป็นภาพว่างเปล่าหรือไม่
    mean_intensity = np.mean(gray)
    #print(f"Mean intensity: {mean_intensity}")
    if mean_intensity > 260:
        #print("❌ Blank image, skipping")
        return False

    # ลบ noise จิ๋ว ๆ และรักษารูปทรงหลักไว้
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # ใช้ Morphological Opening เพื่อลบ noise เล็ก ๆ
    kernel_close = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel_close, iterations=2)

    # ใช้ Morphological Closing เล็กน้อยเพื่อเติมเส้นขาด
    kernel_close = np.ones((2, 2), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel_close, iterations=1)
    #cv2_imshow(thresh)

    # หาคอนทัวร์
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    total_contours = len(contours)
    total_area = sum(cv2.contourArea(cnt) for cnt in contours)
    #print(f"Total contours: {total_contours}, Total area: {total_area}")

    # ตรวจหาเส้นตรง
    edges = cv2.Canny(gray, 50, 150)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 30, minLineLength=20, maxLineGap=5)
    total_lines = len(lines) if lines is not None else 0
    #print(f"Total lines detected: {total_lines}")

    # ตรวจหามุม
    dst = cv2.cornerHarris(np.float32(gray), 2, 3, 0.04)
    total_corners = np.sum(dst > 0.01 * dst.max())
    #print(f"Total corners detected: {total_corners}")

    # ★ เงื่อนไขเพิ่มเติมสำหรับ block กรณีคอนทัวร์เดียวและจำนวนมุมต่ำมาก ★
    #if total_contours == 1 and total_corners < 50:
    #    print("❌ Blocked: Single contour with very few corners")
    #    return False

    # ✅ กรองล่วงหน้า
    if total_lines == 0 and total_corners < 100:
        #print("❌ No structure in image, skipping")
        return False
    
    if (
        total_corners < 60 and
        total_lines < 6 and
        total_area < 500
    ):
        #print("❌ Blocked: Weak structure (too few corners + lines + small area)")
        return False

    # เกณฑ์เบื้องต้น
    max_contours = 30        # ถ้ามี contour มากเกินไป → อาจเป็นลายเซ็นหรือการขีดเขียนมั่ว
    min_area = 250           # ถ้าพื้นที่รวมของ contour น้อยเกินไป → อาจเป็น noise
    max_area = 8000          # ถ้าพื้นที่รวมมากเกินไป → อาจเป็นลายเซ็นใหญ่หรือคราบหมึก
    max_lines = 20           # ถ้าเส้นตรงมากเกินไป → อาจเป็นการขีดเขียนมั่ว
    min_corners = 150        # ถ้าจุดตัด (corners) น้อยเกินไป → อาจไม่ใช่เครื่องหมาย X/Y
    max_corners = 800        # ถ้าจุดตัดเยอะเกินไป → อาจเป็นลายเซ็นหรือรูปที่ซับซ้อน

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
        if total_lines >= 3 and total_area > 300:
            print("⚠️ Few corners but strong structure — continue")
        else:
            #print("❌ Too few corners, skipping")
            return False
    if total_corners > max_corners:
        #print("❌ Too many corners, skipping")
        return False
    if total_area < 250 and total_lines < 2:
        #print("❌ Not enough mark structure, skipping")
        return False

    # เพิ่มกรองกรณีคอนทัวร์เดียวที่มีพื้นที่เล็กและเส้นน้อย
    if total_contours == 1 and total_area < 500 and total_lines < 5:
        #print("❌ Single contour with small area and few lines, skipping")
        return False

    # ✅ ตรวจแต่ละ contour
    for cnt in contours:
        area = cv2.contourArea(cnt)
        perimeter = cv2.arcLength(cnt, True)

        if area < 100 or perimeter < 30:
            continue  # กรอง noise

        x, y, w, h = cv2.boundingRect(cnt)
        if w < 5 or h < 10:
            #print(f"❌ Contour too small: width={w}, height={h}")
            continue

        approx = cv2.approxPolyDP(cnt, 0.02 * perimeter, True)
        #print(f"Contour: Points = {len(approx)}, Width={w}, Height={h}")

        aspect_ratio = w / h if h != 0 else 0
        if len(approx) >= 8 and (aspect_ratio < 0.4 or aspect_ratio > 2.5):
            #print(f"❌ Too complex or non-mark shape: aspect_ratio={aspect_ratio:.2f}")
            continue

        # ✅ ตรวจ extent และ solidity
        rect_area = w * h
        extent = area / rect_area if rect_area > 0 else 0
        hull = cv2.convexHull(cnt)
        hull_area = cv2.contourArea(hull)
        solidity = area / hull_area if hull_area > 0 else 0
        #print(f"Extent={extent:.2f}, Solidity={solidity:.2f}")

        # เงื่อนไขกรองความหลวม
        if extent < 0.4 or solidity < 0.5:
            if extent < 0.1 and solidity < 0.1:
                #print("❌ Too loose structure even with many lines")
                continue

            if total_lines >= 3 and total_area > 300:
                print("⚠️ Low extent/solidity but strong mark — continue")
            else:
                #print("❌ Too sparse or complex shape")
                continue

        if len(approx) >= 3 and total_lines >= 2:
            # รวมเงื่อนไขพิเศษเพื่อ block รูปที่ไม่ใช่ mark จริง
            if (
                (
                    # เงื่อนไขขีดเส้นบาง
                    extent < 0.3 and solidity < 0.4 and w > 70 and h > 90 and
                    total_lines > 10 and total_corners > 200 and mean_intensity > 230
                )
                or
                (
                    # เงื่อนไขขีดอ่อน
                    extent < 0.4 and solidity < 0.65 and total_corners > 450 and
                    total_lines >= 6 and total_area < 1800 and mean_intensity > 220
                )
            ) and not (
                  extent < 0.2 and                 # ยอมให้หลวม แต่ไม่เกินไป
                  solidity > 0.1 and              # มีความแน่นในรูปร่างบ้าง
                  total_area >= 600 and            # มีเนื้อที่พอสมควร
                  total_lines >= 5 and             # มีเส้นชัดเจน
                  total_corners >= 200 and         # มีมุมจำนวนมาก
                  mean_intensity > 220             # ไม่จางเกินไป
            ):
                #print("❌ Blocked specific case: matches one of known false mark patterns")
                return False

            # ✅ เพิ่ม block กรณีใหญ่-สว่าง-เส้นเยอะ
            if (
                total_area > 2000 and
                total_lines > 12 and
                extent < 0.35 and
                solidity < 0.5 and
                mean_intensity > 240
            ):
                #print("❌ Blocked high-intensity large shape with too many lines")
                return False

            # ✅ เพิ่ม block กรณี loose และเบาแบบไม่มีโครงสร้างชัดเจน
            if (
                extent < 0.2 and
                solidity < 0.4 and
                mean_intensity > 230
            ) and (
                total_area >= 1200 and
                total_lines >= 6 and
                total_corners >= 300
            ):
                #print("❌ Blocked soft loose structure that resembles noise or false mark")
                return False

            # ❌ เพิ่ม block case เฉพาะที่ผ่านได้แต่ควรถูกปัดตก
            if (
                total_contours <= 3 and
                total_area > 3000 and
                total_lines >= 15 and
                total_corners >= 400 and
                extent <= 0.55 and
                solidity <= 0.6
            ):
                #print("❌ Blocked: Pattern resembles false positive (scribble-like structure)")
                return False
                
            if (
                total_contours <= 3 and
                total_lines < 10 and
                total_corners < 100 and
                extent > 0.55 and
                solidity > 0.65
            ):
                #print("❌ Blocked: Pattern resembles false positive (false mark with high extent/solidity)")
                return False


            #print("✅ Detected from contour")
            return True

    # ✅ ตรวจ heuristics ภาพรวม (fallback)
    if total_lines >= 6 and total_area > 1000:
        #print("✅ Detected from strong lines and area (fallback)")
        return True

    return False


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

def perform_cv(roi=None, box_index=None):
    if detect_mark_in_roi(roi):
        choices = ["A", "B", "C", "D", "E"]
        predicted_text = choices[box_index]
    else:
        # ถ้าไม่มีตัวอักษรในภาพ ให้ predicted_text เป็นค่าว่าง
        predicted_text = ""
        print("ไม่เจอ")
        
    return predicted_text

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

    return " "

def preprocess_roi(roi):
    """
    รับภาพ ROI (OpenCV format), ทำ preprocessing เพื่อเพิ่มความแม่นยำของ OCR
    โดยไม่ยืดภาพ แต่เติมขอบขาวให้ขนาดตรงกับ TrOCR
    """
    # Convert to grayscale
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    # Adaptive thresholding
    thresh = cv2.adaptiveThreshold(gray, 255,
                                   cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY, 11, 2)

    # Denoising
    denoised = cv2.medianBlur(thresh, 3)

    # เติมขอบสีขาวเพื่อให้ได้ขนาด 384x64
    target_width, target_height = 384, 64
    h, w = denoised.shape[:2]

    # คำนวณ scale ที่ไม่บิดเบือน
    scale = min(target_width / w, target_height / h)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(denoised, (new_w, new_h), interpolation=cv2.INTER_AREA)

    # สร้างภาพพื้นหลังขาว
    canvas = np.ones((target_height, target_width), dtype=np.uint8) * 255
    x_offset = (target_width - new_w) // 2
    y_offset = (target_height - new_h) // 2

    # วางภาพที่ resize ลงไปบน canvas
    canvas[y_offset:y_offset + new_h, x_offset:x_offset + new_w] = resized

    # แสดงภาพที่ผ่านการปรับแต่ง
    #cv2_imshow(canvas)

    # Convert to RGB PIL Image
    roi_pil = Image.fromarray(canvas).convert("RGB")
    return roi_pil



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
            #print("Error: ROI is not provided for sentence prediction.")
            predicted_text = " "

    elif label == "id":
        generated_ids = large_trocr_model.generate(pixel_values, max_new_tokens=3)
        predicted_text = large_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

        predicted_text = normalize_predict(predicted_text)    

        #print(f"filtered predicted_text: '{predicted_text}'")  # Debugging
        # กรองเฉพาะตัวเลข
        #predicted_text = re.sub(r'\D', '-', predicted_text)[:1]

    elif label == "number":
        generated_ids = large_trocr_model.generate(pixel_values, max_new_tokens=3)
        predicted_text = large_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

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

        predicted_text = predicted_text.upper()  # แปลงเป็นตัวพิมพ์ใหญ่ทั้งหมด
        predicted_text = re.sub(r'[^A-Z]', ' ', predicted_text)[:1] # กรองเฉพาะตัวอักษร

    elif label == "choice" and box_index is not None:
        generated_ids = base_trocr_model.generate(pixel_values, max_new_tokens=6)
        predicted_text = base_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

        #print(f"Predicted Trocr: {predicted_text}")

        cleaned_text = predicted_text.strip()

        if cleaned_text == "":
            # ถ้าเป็นค่าว่าง ไม่ผ่าน
            predicted_text = ""

        # ถ้าเป็นตัวอักษร หรือตัวเลข 1 หลัก → แมป A–E
        elif any(c.isalpha() for c in cleaned_text) or (cleaned_text.isdigit() and len(cleaned_text) == 1):
            choices = ["A", "B", "C", "D", "E"]
            predicted_text = choices[box_index]

        elif cleaned_text in ["/"]:
            choices = ["A", "B", "C", "D", "E"]
            predicted_text = choices[box_index]

        elif cleaned_text in ["0 1"]:
            choices = ["A", "B", "C", "D", "E"]
            predicted_text = choices[box_index]

        # ถ้าเป็นเลข 1 หรือ 2 หลัก และอาจตามด้วย "."
        elif re.fullmatch(r"\d{1,2}\.?", cleaned_text):
            choices = ["A", "B", "C", "D", "E"]
            predicted_text = choices[box_index]
        else:
            predicted_text = ""


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

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)

        # ค้นหา Contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # บันทึกผลลัพธ์
        predictions = {}

        # วนลูปใน JSON
        for key, value in positions.items():
            prediction_list = []  # สำหรับเก็บผลการพยากรณ์
            padding = 8  # จำนวนพิกเซลที่ต้องการลบจากแต่ละด้าน

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
                        x1, y1, x2, y2 = box_json

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
                            roi_pil = preprocess_roi(roi)

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
                    predict_cv = []  # เพิ่มไว้สำหรับ label = choice

                    for idx, box_json in enumerate(value['position']):
                        if stop_flag.stop_flag:  # เช็คค่า stop_flag แบบ real-time
                            print(f"Stop flag list list")
                            break
                        
                        x1, y1, x2, y2 = box_json

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
                            roi_pil = preprocess_roi(roi)

                            # แปลง ROI และพยากรณ์
                            roi_pil = Image.fromarray(cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)).convert("RGB")
                            pixel_values = large_processor(roi_pil, return_tensors="pt").pixel_values
                            predicted_text = perform_prediction(pixel_values, label, roi, box_index=idx)
                            # cv2.rectangle(image, (x1, y1), (x2, y2), (255, 0, 0), 2)
                            # cv2.putText(image, predicted_text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 2.0, (255, 0, 0), 2)
                            # print(f"Predicted text for key {key}, box {idx}: {predicted_text}")

                            # เก็บผลลัพธ์ใน prediction_list
                            prediction_list.append(predicted_text)

                            # ตรวจสอบเฉพาะ choice
                            if label == "choice":
                                cv_text = perform_cv(roi, box_index=idx)
                                predict_cv.append(cv_text)
                                #print(f"Predicted text for key {key}, box {idx}: {cv_text}")

                    # เก็บคำตอบทั้งหมดใน key
                    # เงื่อนไขการเลือกผลลัพธ์สุดท้ายสำหรับ label == choice
                    if label == "choice":
                        #print(f"[DEBUG] prediction_list for key '{key}':", prediction_list)
                        #print(f"[DEBUG] predict_cv for key '{key}':", predict_cv)
                        if not prediction_list:
                            predictions[key] = ''.join(predict_cv)
                        elif len(''.join(prediction_list)) > 1:
                            common = [char for char in predict_cv if char in prediction_list]
                            if common:
                                predictions[key] = ''.join(common)
                            else:
                                predictions[key] = ''.join(prediction_list)
                        else:
                            predictions[key] = ''.join(prediction_list)
                    else:
                        predictions[key] = ''.join(prediction_list)


                else:  # หาก position เป็น list เดี่ยว
                    box_json = value['position']
                    x1, y1, x2, y2 = box_json

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
                        roi_pil = preprocess_roi(roi)

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
        if conn is None:
            print("Database connection failed")
            return

        cursor = conn.cursor()

        try:
            for key, value in predictions.items():
                if key == "studentID":
                    # อัปเดต `Id_predict` ใน `Exam_sheet`
                    update_exam_sheet_query = """
                        UPDATE Exam_sheet
                        SET Id_predict = ?
                        WHERE Sheet_id = ?;
                    """
                    cursor.execute(update_exam_sheet_query, (value, paper))
                    # print(f"Key studentID: {value}")
                else:
                    # ค้นหา Label_id จากตาราง Label
                    find_label_query = """
                        SELECT Label_id
                        FROM Label
                        WHERE No = ? AND Subject_id = ?;
                    """
                    cursor.execute(find_label_query, (key, subject))

                    ans_label = cursor.fetchone()

                    if ans_label:
                        ans_label_id = ans_label[0]  # ดึง label_id

                        # แทรกข้อมูลลงตาราง Answer
                        insert_answer_query = """
                            INSERT INTO Answer (Label_id, Modelread, Sheet_id)
                            VALUES (?, ?, ?);
                        """
                        cursor.execute(insert_answer_query, (ans_label_id, value, paper))
                        # print(f"Key {key}: {value}")
                    else:
                        print(f"Label No {key} ไม่พบในฐานข้อมูล")

            # คอมมิตการเปลี่ยนแปลง
            conn.commit()
            print("การบันทึกข้อมูลเสร็จสิ้น")

        except sqlite3.Error as e:
            conn.rollback()
            print(f"Database error: {str(e)}")

        finally:
            # ปิดการเชื่อมต่อ
            cursor.close()
            conn.close()

        cal_score(paper, socketio)
        # หลัง cal_score เสร็จ ให้บังคับส่ง event ทันที
        socketio.sleep(0.1)  # หรือ 0
        stop_flag.stop_flag


def cal_score(paper, socketio):
    # เชื่อมต่อกับฐานข้อมูล
    conn = get_db_connection()
    if conn is None:
        print("Database connection failed")
        return

    conn.row_factory = sqlite3.Row  # ใช้ row_factory เพื่อเข้าถึงค่าผ่านชื่อคอลัมน์
    cursor = conn.cursor()

    # Query ดึงข้อมูล Answer, Label และ Group_Point
    query = '''
        SELECT a.Ans_id, a.Label_id, a.Modelread, a.Score_point, 
               l.Answer, l.Point_single, l.Group_No, gp.Point_Group, l.Type, l.Free
        FROM Answer a
        JOIN Label l ON a.Label_id = l.Label_id
        LEFT JOIN Group_Point gp ON l.Group_No = gp.Group_No
        WHERE a.Sheet_id = ?
    '''
    cursor.execute(query, (paper,))
    answers = cursor.fetchall()

    if not answers:
        print(f"No answers found for Sheet_id: {paper}")
        return
    
    # อัปเดตค่า Modelread ทั้งหมดให้เป็นพิมพ์ใหญ่ (เฉพาะแถวใน sheet นี้)
    update_upper_query = '''
        UPDATE Answer
        SET Modelread = UPPER(Modelread)
        WHERE Sheet_id = ?
    '''
    cursor.execute(update_upper_query, (paper,))


    sum_score = 0

    # เก็บข้อมูลคำตอบแบบกลุ่ม (ทุกแถวที่ Group_No != None)
    group_answers = {}      # { group_no: [ row1, row2, ... ], ... }
    checked_groups = set()  # เก็บ group_no ที่ตรวจไปแล้ว

    for row in answers:
        group_no = row["Group_No"]
        if group_no is not None:
            if group_no not in group_answers:
                group_answers[group_no] = []
            group_answers[group_no].append(row)

    # (A) วนตรวจแถวที่ "ไม่อยู่ในกลุ่ม" ก่อน (group_no is None)
    for row in answers:
        ans_id       = row["Ans_id"]
        ans_type     = row["Type"]
        modelread_str = (row["Modelread"] or "")
        answer_str   = (row["Answer"]    or "")
        point_single = row["Point_single"]
        Score_point  = row["Score_point"]
        group_no     = row["Group_No"]
        free         = row["Free"]

        # 1) ข้ามไปก่อนถ้าอยู่ในกลุ่ม
        if group_no is not None:
            continue

        # 2) ตรวจสอบ type = 'free'
        if free == 1:
            # บวกคะแนนถ้ามี point_single
            if point_single is not None:
                sum_score += point_single
                # อัปเดต Answer.Score_point = point_single (ถ้าอยากบันทึก)
                update_answer_query = '''
                    UPDATE Answer
                    SET Score_point = ?
                    WHERE Ans_id = ?
                '''
                cursor.execute(update_answer_query, (point_single, ans_id))

            # กรณี free + group_no ไม่มีในที่นี้ เพราะ group_no is None
            print(f"Ans_id {ans_id} (free, no group): Done.")
            continue

        # 3) ตรวจสอบ type = '6'
        if ans_type == '6':
            # ตัวอย่างให้ score_point เป็น 0 เสมอ
            update_answer_query = '''
                UPDATE Answer
                SET Score_point = 0
                WHERE Ans_id = ?
            '''
            cursor.execute(update_answer_query, (ans_id,))
            print(f"Ans_id {ans_id} (type=6, no group): Set Score_point=0.")
            continue

        # 4) ตรวจสอบ type = '3' แบบเดี่ยว (ไม่อยู่ในกลุ่ม)
        if ans_type == '3' and answer_str:
            # มี '.' => ใช้ startswith
            if '.' in answer_str:
                if modelread_str.startswith(answer_str):
                    # อัปเดต Modelread = answer
                    cursor.execute('UPDATE Answer SET Modelread=? WHERE Ans_id=?', (answer_str, ans_id))
                    # บวกคะแนนจาก point_single
                    if point_single is not None:
                        sum_score += point_single
                        # อัปเดต Score_point
                        update_answer_query = '''
                            UPDATE Answer
                            SET Score_point = ?
                            WHERE Ans_id = ?
                        '''
                        cursor.execute(update_answer_query, (point_single, ans_id))

            else:
                # ไม่มี '.' => ต้อง == เป๊ะ
                if modelread_str == answer_str:
                    if point_single is not None:
                        sum_score += point_single
                        # อัปเดต Score_point
                        update_answer_query = '''
                            UPDATE Answer
                            SET Score_point = ?
                            WHERE Ans_id = ?
                        '''
                        cursor.execute(update_answer_query, (point_single, ans_id))
            continue

        # 5) กรณี type อื่น ๆ (ไม่ใช่ 3 / 6 / free)
        modelread_lower = modelread_str.lower()
        answer_lower    = answer_str.lower()
        if modelread_lower == answer_lower and point_single is not None:
            sum_score += point_single
            # อัปเดต Score_point
            update_answer_query = '''
                UPDATE Answer
                SET Score_point = ?
                WHERE Ans_id = ?
            '''
            cursor.execute(update_answer_query, (point_single, ans_id))

    # (B) ตรวจสอบกลุ่ม (เมื่อ group_no != None)
    for g_no, rows_in_group in group_answers.items():
        if g_no in checked_groups:
            continue

        all_correct = True

        for row in rows_in_group:
            ans_id       = row["Ans_id"]
            ans_type     = row["Type"]
            modelread_str = (row["Modelread"] or "")
            answer_str   = (row["Answer"]    or "")

            # ตรวจ logic ของ type=3
            if ans_type == '3' and answer_str:
                if '.' in answer_str:
                    # ตรวจด้วย startswith
                    if not modelread_str.startswith(answer_str):
                        all_correct = False
                        break
                    else:
                        cursor.execute('UPDATE Answer SET Modelread=? WHERE Ans_id=?', (answer_str, ans_id))
                else:
                    # ไม่มี '.' => ต้อง ==
                    if modelread_str != answer_str:
                        all_correct = False
                        break
                    
            else:
                # type อื่น => เทียบตรงแบบ lower
                if modelread_str.lower() != answer_str.lower():
                    all_correct = False
                    break

        # สรุปผลทั้งกลุ่ม
        if all_correct:
            # ได้ Point_Group
            p_group = rows_in_group[0]["Point_Group"]  # เอาค่าจากแถวแรก (หรือแล้วแต่ตกลง)
            if p_group is not None:
                sum_score += p_group
                # อัปเดต Score_point ของแถวแรกในกลุ่ม เพื่อบันทึกว่ากลุ่มนี้ได้คะแนนเท่าไร
                first_ans_id = rows_in_group[0]["Ans_id"]
                cursor.execute('''
                    UPDATE Answer
                    SET Score_point = ?
                    WHERE Ans_id = ?
                ''', (p_group, first_ans_id))
        else:
            # ไม่ถูกทั้งหมด 
            # ตั้ง Score_point ของแถวแรกในกลุ่ม = 0 (หรือทุกแถวตามต้องการ)
            first_ans_id = rows_in_group[0]["Ans_id"]
            cursor.execute('''
                UPDATE Answer
                SET Score_point = 0
                WHERE Ans_id = ?
            ''', (first_ans_id,))

        checked_groups.add(g_no)

    # (C) อัปเดตคะแนนรวมใน Exam_sheet
    update_query = '''
        UPDATE Exam_sheet
        SET Score = ?
        WHERE Sheet_id = ?
    '''
    cursor.execute(update_query, (sum_score, paper))
    conn.commit()
    print(f"Updated total score: {sum_score} for Sheet_id: {paper}")

    # ปิดการเชื่อมต่อ
    cursor.close()
    conn.close()

    # ส่ง event ไปยัง Frontend
    socketio.emit('score_updated', {'message': 'Score updated for one paper'})
