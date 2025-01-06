import sys
from pdf2image import convert_from_path
import fitz  # PyMuPDF for handling PDFs
import cv2
import numpy as np
import os
from db import get_db_connection


# กำหนดตัวแปรที่ต้องการให้เป็น global variables
subject_id = 0
page_no = 0
page_id = 0


#----------------------- update ---------------------------- 
def new_variable(new_subject_id, new_page_no):
    global subject_id, page_no

    subject_id = new_subject_id
    page_no = new_page_no
     
    print("Updated Subject ID:", subject_id)
    print("Updated page_no:", page_no)

#----------------------- reset ---------------------------- 
def reset_variable():
    global subject_id, page_no, page_id

    subject_id = 0
    page_no = 0
    page_id = 0

    print("Variables have been reset.")


#----------------------- convert img ----------------------------
 
def convert_pdf(pdf_buffer, subject_id, page_no):
    global page_id

    try:
        # เชื่อมต่อฐานข้อมูล
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. ค้นหา Page_id จาก Subject_id และ page_no
        cursor.execute("SELECT Page_id FROM Page WHERE Subject_id = %s AND page_no = %s", (subject_id, page_no))
        page = cursor.fetchone()
        if not page:
            print("ไม่พบ Page_id สำหรับ Subject_id และ page_no ที่ระบุ")
            return
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

            for contour in contours:
                approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
                if len(approx) == 4:  # ตรวจสอบว่าสี่เหลี่ยมมี 4 ด้าน
                    x, y, w, h = cv2.boundingRect(approx)
                    if 50 < w < 200 and 50 < h < 200:
                        detected_boxes.append((x, y, x + w, y + h))

            # แปลงมุมมองถ้ามี 4 กล่อง
            if len(detected_boxes) >= 4:
                detected_boxes[2], detected_boxes[-2] = detected_boxes[-2], detected_boxes[2]
                detected_boxes[3], detected_boxes[-1] = detected_boxes[-1], detected_boxes[3]

                box_1, box_2, box_3, box_4 = detected_boxes[:4]
                src_points = np.array([
                    [box_4[0], box_4[1]], [box_3[2], box_3[1]],
                    [box_2[0], box_2[3]], [box_1[2], box_1[3]]
                ], dtype='float32')

                dst_points = np.array([
                    [150, 100], [2330, 100],
                    [150, 3408], [2330, 3408]
                ], dtype='float32')

                # คำนวณ Homography และแปลงภาพ
                matrix, _ = cv2.findHomography(src_points, dst_points, cv2.RANSAC, 3.0)
                warped_image = cv2.warpPerspective(img_resized, matrix, (2480, 3508), borderMode=cv2.BORDER_REPLICATE)

                # ครอบภาพให้พอดี
                gray = cv2.cvtColor(warped_image, cv2.COLOR_BGR2GRAY)
                _, mask = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
                contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

                if contours:
                    max_contour = max(contours, key=cv2.contourArea)
                    x, y, w, h = cv2.boundingRect(max_contour)
                    cropped_image = warped_image[y:y+h, x:x+w]
                    resized_image = cv2.resize(cropped_image, (2480, 3508))
                else:
                    resized_image = warped_image

            else:
                resized_image = img_resized
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
    except Exception as e:
        print(f"เกิดข้อผิดพลาด: {e}")
    finally:
        # ปิดการเชื่อมต่อฐานข้อมูลเสมอ
        if cursor:
            cursor.close()
        if conn:
            conn.close()