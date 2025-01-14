import eventlet
eventlet.monkey_patch()
from flask import Flask, request, jsonify,  send_file, Response, send_from_directory , abort
from flask_cors import CORS
import base64
from io import BytesIO
import os
from PIL import Image
import sheet
from sheet import update_array, update_variable, get_images_as_base64 , reset , stop_flag 
from db import get_db_connection
import shutil
import subprocess
import csv
import ftfy  
import chardet
from werkzeug.utils import secure_filename
from decimal import Decimal
from flask_socketio import SocketIO, emit
# from predict import new_variable, convert_pdf, reset_variable, convert_allpage 
from predict import convert_pdf, convert_allpage, check
import time
import json
import math
import numpy as np
import pymysql
from fpdf import FPDF
import glob

app = Flask(__name__)
# CORS(app)
# กำหนด CORS ระดับแอป (อนุญาตทั้งหมดเพื่อความง่ายใน dev)
CORS(app, resources={r"/*": {"origins": "*"}})

# หรือกำหนดใน SocketIO ด้วย
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')


#----------------------- Create ----------------------------

subject_id = 0
type_point_array = []

@app.route('/check_subject', methods=['POST'])
def check_subject():
    global subject_id

    data = request.json
    new_subject_id = data.get('subject_id')  # รับ subject_id ที่เลือกจาก React
 
    subject_id = new_subject_id
    print("Subject check:", subject_id)

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM Page WHERE Subject_id = %s", (subject_id,))
    result = cursor.fetchone()
    conn.close()

    exists = result[0] > 0
    return jsonify({"exists": exists})


@app.route('/create_sheet', methods=['POST'])
def create_sheet():
    global subject_id, type_point_array

    data = request.json
    new_subject_id = data.get('subject_id')
    part = int(data.get('part'))
    page_number = int(data.get('page_number'))

    subject_id = new_subject_id
    print("Subject ID:", subject_id)

    type_point_array = []
    sheet.reset()

    update_variable(new_subject_id, part, page_number)
    return jsonify({"status": "success", "message": "Sheet created"})

@app.route('/submit_parts', methods=['POST'])
def submit_parts():
    global subject_id

    # สร้างโฟลเดอร์ตาม subject_id
    folder_path = f'./{subject_id}'
    os.makedirs(folder_path, exist_ok=True)

    data = request.json
    case_array = data.get('case_array')
    range_input_array = data.get('range_input_array')
    new_type_point_array = data.get('type_point_array')
    option_array = data.get('option_array')
    lines_dict_array = data.get("lines_dict_array", [])  # รับ lines_dict_array

    if new_type_point_array is None:
        return jsonify({"status": "error", "message": "type_point_array is missing"}), 400
    else:
        type_point_array.extend(new_type_point_array)
        print("Updated TypePoint Array:", type_point_array)
 
    update_array(case_array, range_input_array, option_array, lines_dict_array)
    return jsonify({"status": "success", "message": "Parts data submitted"})


@app.route('/get_images', methods=['GET'])
def get_images():
    # เรียกใช้ฟังก์ชัน get_images_as_base64 เพื่อแปลงภาพทั้งหมดเป็น Base64
    base64_images = get_images_as_base64()
    return jsonify({"status": "success", "images": base64_images})

# ฟังก์ชันเพื่อแปลง base64 เป็นภาพ PIL.Image
def convert_base64_to_images(base64_images):
    images = []
    for img_str in base64_images:
        img_data = base64.b64decode(img_str)
        img = Image.open(BytesIO(img_data))
        images.append(img)
    return images

@app.route('/save_images', methods=['POST'])
def save_images():
    data = request.json
    base64_images = data.get('images')  # รับ base64 ของภาพจากคำขอ

    if not base64_images or not subject_id:
        return jsonify({"status": "error", "message": "No images provided or subject_id is not set"}), 400

    # สร้างโฟลเดอร์ตาม subject_id
    folder_path = f'./{subject_id}/pictures'
    os.makedirs(folder_path, exist_ok=True)

    # แปลง base64 เป็นภาพ
    images = convert_base64_to_images(base64_images)

    # บันทึกภาพลงในโฟลเดอร์และอัปเดตฐานข้อมูล
    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Database connection failed"}), 500
    cursor = conn.cursor()


    try:
        for idx, img in enumerate(images):
            # บันทึกภาพในโฟลเดอร์
            img_path = f'{folder_path}/{idx + 1}.jpg'
            img.save(img_path)
            print(f"บันทึก {img_path} สำเร็จ")

            # เพิ่มข้อมูลใน Table: Page
            cursor.execute(
                """
                INSERT INTO Page (Subject_id, page_no)
                VALUES (%s, %s)
                """,
                (subject_id, idx + 1)
            )
            print(f"เพิ่ม Page: Subject_id={subject_id}, page_no={idx + 1} ในฐานข้อมูลสำเร็จ")

        # เพิ่มข้อมูลจาก type_point_array ในตาราง label และ Group_Point
        group_no_mapping = {}  # ใช้เก็บ mapping ระหว่าง order และ Group_No
        #group_counter = 1  # ตัวนับ Group_No เริ่มต้น

        # เพิ่มข้อมูลจาก type_point_array ในตาราง label
        for item in type_point_array:  # วนลูป dict ใน type_point_array
            for no, data in item.items():  # วนลูป key (No) และ value (data) ใน dict
                label_type = data.get('type')
                point = data.get('point')
                order = data.get('order')

                if label_type.lower() == 'single':
                    # เพิ่มข้อมูลใน label สำหรับประเภท Single
                    cursor.execute(
                        """
                        INSERT INTO label (Subject_id, No, Point_single)
                        VALUES (%s, %s, %s)
                        """,
                        (subject_id, no, point)
                    )
                    # print(f"เพิ่มข้อมูลใน label: Subject_id={subject_id}, No={no}, Point_single={point}")
                elif label_type.lower() == 'group':
                    # จัดการ Group_No
                    if order not in group_no_mapping:
                        # เพิ่ม Group_Point ใหม่
                        cursor.execute(
                            """
                            INSERT INTO Group_Point (Point_Group)
                            VALUES (%s)
                            """,
                            (point,)
                        )
                        conn.commit()  # Commit เพื่อดึงค่า AUTO_INCREMENT
                        group_no_mapping[order] = cursor.lastrowid  # ดึง Group_No ล่าสุด
                    group_no = group_no_mapping[order]

                    # เพิ่มข้อมูลใน label สำหรับประเภท Group
                    cursor.execute(
                        """
                        INSERT INTO label (Subject_id, No, Group_No)
                        VALUES (%s, %s, %s)
                        """,
                        (subject_id, no, group_no)
                    )

        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Error: {str(e)}")
        return jsonify({"status": "error", "message": "Failed to save images or update database"}), 500
    finally:
        cursor.close()
        conn.close()

    return jsonify({"status": "success", "message": "Images saved successfully"})


#----------------------- reset examsheet----------------------------

@app.route('/reset/<string:subject_id>', methods=['DELETE'])
def reset(subject_id):
    global type_point_array  # ยังคงใช้ type_point_array เป็น global
 
    try:
        # เชื่อมต่อฐานข้อมูล
        conn = get_db_connection()
        if conn is None:
            return jsonify({"status": "error", "message": "Database connection failed"}), 500
        cursor = conn.cursor()

        # เริ่ม Transaction
        conn.start_transaction()

        # 1. ลบข้อมูลในตาราง Answer
        cursor.execute('DELETE FROM Answer WHERE label_id IN (SELECT label_id FROM label WHERE Subject_id = %s)', (subject_id,))
        # 2. ลบข้อมูลในตาราง Exam_sheet
        cursor.execute('DELETE FROM Exam_sheet WHERE Page_id IN (SELECT Page_id FROM Page WHERE Subject_id = %s)', (subject_id,))
        # 3. ลบข้อมูลในตาราง Page
        cursor.execute('DELETE FROM Page WHERE Subject_id = %s', (subject_id,))
        # 4. ลบข้อมูลในตาราง label
        cursor.execute('DELETE FROM label WHERE Subject_id = %s', (subject_id,))
        # 5. ลบ Group_Point ที่ไม่ได้ถูกใช้
        cursor.execute('DELETE FROM Group_Point WHERE Group_No NOT IN (SELECT DISTINCT Group_No FROM label WHERE Group_No IS NOT NULL)')
        # 6. ลบ Answer ที่ไม่มี label_id
        cursor.execute('DELETE FROM Answer WHERE label_id NOT IN (SELECT DISTINCT label_id FROM label)')
        # 7. ลบ Exam_sheet ที่ไม่มี Sheet_id
        cursor.execute('DELETE FROM Exam_sheet WHERE Sheet_id NOT IN (SELECT DISTINCT Sheet_id FROM Answer)')

        # Commit การลบข้อมูล
        conn.commit()

        # ลบโฟลเดอร์ ./{subject_id} หากมี
        folder_path = f'./{subject_id}'
        if os.path.exists(folder_path):
            shutil.rmtree(folder_path)  # ลบโฟลเดอร์และไฟล์ทั้งหมดในโฟลเดอร์
            print(f"Folder {folder_path} deleted successfully.")
        else:
            print(f"Folder {folder_path} does not exist. Skipping folder deletion.")

    except mysql.connector.Error as e:
        # Rollback หากเกิดข้อผิดพลาด
        conn.rollback()
        return jsonify({"status": "error", "message": f"Database error: {str(e)}"}), 500

    except Exception as e:
        # ข้อผิดพลาดในการลบโฟลเดอร์
        return jsonify({"status": "error", "message": f"Error deleting folder: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()

    # รีเซ็ตค่า type_point_array
    type_point_array = []
    sheet.reset()  # เรียกฟังก์ชัน reset

    return jsonify({"status": "reset done", "message": f"Reset complete for subject_id {subject_id}"}), 200

#----------------------- view examsheet----------------------------
@app.route('/view_pages/<subject_id>', methods=['GET'])
def view_pages(subject_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT Page_id, page_no FROM Page WHERE Subject_id = %s', (subject_id,))
    pages = cursor.fetchall()
    cursor.close()
    conn.close()

    page_list = [
        {
            "Page_id": page["Page_id"],  # เพิ่ม Page_id เพื่อใช้เป็น unique key
            "page_no": page["page_no"],
            "image_path": f"/backend/{subject_id}/pictures/{page['page_no']}.jpg"
        }
        for page in pages
    ]
    return jsonify({"status": "success", "data": page_list})

@app.route('/get_image/<subject_id>', methods=['GET'])
def get_image(subject_id):
    folder_path = os.path.join(subject_id, 'pictures')
    if not os.path.exists(folder_path):
        return jsonify({"status": "error", "message": "Subject folder not found"}), 404

    images = os.listdir(folder_path)
    images_data = [
        {"image_id": idx + 1, "image_path": f"/{subject_id}/pictures/{img}"}
        for idx, img in enumerate(images)
    ]
    return jsonify({"status": "success", "data": images_data})


@app.route('/get_image_subject/<subject_id>/<filename>', methods=['GET'])
def get_image_subject(subject_id, filename):
    # กำหนดโฟลเดอร์ที่เก็บไฟล์
    folder_path = os.path.join(subject_id, 'pictures')  # ตัวอย่างโฟลเดอร์ ./080303103/pictures/
    file_path = os.path.join(folder_path, filename)
    # Debugging
    print(f"Searching for file at: {file_path}")
    # ตรวจสอบว่าไฟล์มีอยู่จริง
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")  # Debugging
        return jsonify({"status": "error", "message": "File not found"}), 404

    try:
        # ส่งไฟล์กลับไปยัง Front-end
        return send_file(file_path, mimetype='image/jpeg')
    except Exception as e:
        print(f"Error sending file: {e}")
        return jsonify({"status": "error", "message": "Failed to send file"}), 500
      
    
@app.route('/download_image/<subject_id>/<image_id>', methods=['GET'])
def download_image(subject_id, image_id):
    file_path = f'./{subject_id}/pictures/{image_id}.jpg'
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    else:
        return jsonify({"status": "error", "message": "Image not found"}), 404

@app.route('/download_pdf/<subject_id>', methods=['GET'])
def download_pdf(subject_id):
    folder_path = os.path.join(subject_id, 'pictures')  # โฟลเดอร์เก็บภาพ
    images = sorted(glob.glob(f"{folder_path}/*.jpg"))  # ดึงรูปทั้งหมดในโฟลเดอร์
    
    if not images:
        return jsonify({"status": "error", "message": "No images found"}), 404
    
    pdf = FPDF()
    for img_path in images:
        pdf.add_page()
        pdf.image(img_path, x=10, y=10, w=190)  # ปรับตำแหน่งและขนาดภาพ
    
    pdf_output_path = os.path.join(folder_path, "combined.pdf")
    pdf.output(pdf_output_path)

    return send_file(pdf_output_path, as_attachment=True, download_name=f"{subject_id}.pdf")

@app.route('/reset_page', methods=['POST'])
def reset_page():
    global subject_id
    data = request.get_json()
    subject_id = data.get('subject_id')  # อัปเดต subject_id จาก request

    if subject_id is None:
        return jsonify({"status": "error", "message": "Subject ID is missing"}), 400

    # เรียกใช้ฟังก์ชัน reset() เพื่อทำการรีเซ็ต
    return reset()  # จะใช้โค้ดของ def reset() ที่กำหนดไว้


#----------------------- Subject----------------------------

@app.route('/add_subject', methods=['POST'])
def add_subject():
    data = request.json
    subject_id = data.get("Subject_id")
    subject_name = data.get("Subject_name")

    if not subject_id or not subject_name:
        return jsonify({"message": "Subject ID and Subject Name are required"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"message": "Failed to connect to the database"}), 500

    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO Subject (Subject_id, Subject_name) VALUES (%s, %s)',
        (subject_id, subject_name)
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Subject added successfully"}), 201
    
@app.route('/get_subjects', methods=['GET'])
def get_subjects():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT * FROM Subject')
    subjects = cursor.fetchall()
    cursor.close()
    conn.close()

    subject_list = [
        {"Subject_id": subject["Subject_id"], "Subject_name": subject["Subject_name"]}
        for subject in subjects
    ]
    return jsonify(subject_list)

@app.route('/edit_subject', methods=['PUT'])
def edit_subject():
    data = request.json
    print("Received data:", data)  # Log ข้อมูลที่รับมา

    current_subject_id = data.get("Current_Subject_id")  # Subject_id เดิม
    new_subject_id = data.get("New_Subject_id")         # Subject_id ใหม่
    new_subject_name = data.get("Subject_name")         # ชื่อวิชาใหม่

    if not current_subject_id or not new_subject_id or not new_subject_name:
        return jsonify({"message": "All fields are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # ตรวจสอบว่า Subject_id ใหม่ซ้ำกับค่าอื่นในฐานข้อมูลหรือไม่ (เฉพาะกรณีที่ Subject_id เปลี่ยน)
    if current_subject_id != new_subject_id:
        cursor.execute(
            'SELECT * FROM Subject WHERE Subject_id = %s',
            (new_subject_id,)
        )
        if cursor.fetchone() is not None:
            print("Duplicate Subject ID:", new_subject_id)
            return jsonify({"message": "Update failed. Subject ID already exists."}), 400

    # อัปเดตข้อมูลทั้ง Subject_id และ Subject_name
    cursor.execute(
        'UPDATE Subject SET Subject_id = %s, Subject_name = %s WHERE Subject_id = %s',
        (new_subject_id, new_subject_name, current_subject_id)
    )
    conn.commit()

    print("Rows updated:", cursor.rowcount)
    cursor.close()
    conn.close()

    return jsonify({"message": "Subject updated successfully"}), 200


@app.route('/delete_subject/<string:subject_id>', methods=['DELETE'])
def delete_subject(subject_id):
  
    try:
       conn = get_db_connection()
       cursor = conn.cursor()
       cursor.execute('DELETE FROM Subject WHERE Subject_id = %s', (subject_id,))
       conn.commit()
       cursor.close()
       conn.close()
       return jsonify({"message": "Subject deleted successfully"}), 200



    except Exception as e:
        # หากเกิดข้อผิดพลาด ให้ยกเลิกการเปลี่ยนแปลง
        conn.rollback()
        print(f"Error: {e}")
        return jsonify({"error": "Failed to delete subject"}), 500

    finally:
        # ปิดการเชื่อมต่อ
        cursor.close()
        conn.close()



#----------------------- Label ----------------------------
def serialize_decimal(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

@app.route('/get_labels/<subject_id>', methods=['GET'])
def get_labels(subject_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT 
                l.Label_id, 
                l.No, 
                l.Answer, 
                l.Point_single, 
                l.Group_No, 
                gp.Point_Group 
            FROM Label l
            LEFT JOIN group_point gp ON l.Group_No = gp.Group_No
            WHERE l.Subject_id = %s
            ORDER BY l.No
            """,
            (subject_id,)
        )
        rows = cursor.fetchall()
        return jsonify({"status": "success", "data": rows})
    except Exception as e:
        print(f"Error fetching labels: {e}")
        return jsonify({"status": "error", "message": "Failed to fetch labels"}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/update_label/<label_id>', methods=['PUT'])
def update_label(label_id):
    data = request.json
    answer = data.get('Answer')

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # อัปเดตข้อมูลในตาราง label
        cursor.execute(
            """
            UPDATE Label
            SET Answer = %s
            WHERE Label_id = %s
            """,
            (answer, label_id)
        )
        conn.commit()

        return jsonify({"status": "success", "message": "Answer updated successfully"})
    except Exception as e:
        print(f"Error updating answer: {e}")
        return jsonify({"status": "error", "message": "Failed to update answer"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/update_point/<label_id>', methods=['PUT'])
def update_point(label_id):
    data = request.json
    point = data.get('point', None)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # ตรวจสอบ Group_No จาก label_id
        cursor.execute("SELECT Group_No FROM Label WHERE Label_id = %s", (label_id,))
        result = cursor.fetchone()

        if result is None:
            return jsonify({"status": "error", "message": "Label_id not found"}), 404

        group_no = result[0]

        if group_no is None:
            # กรณี Group_No เป็น null
            cursor.execute(
                """
                UPDATE Label
                SET Point_single = %s
                WHERE Label_id = %s
                """,
                (point, label_id)
            )
        else:
            # กรณี Group_No ไม่เป็น null
            cursor.execute(
                """
                UPDATE Group_Point
                SET Point_Group = %s
                WHERE Group_No = %s
                """,
                (point, group_no)
            )

        conn.commit()
        return jsonify({"status": "success", "message": "Point updated successfully"})

    except Exception as e:
        print(f"Error updating point: {e}")
        return jsonify({"status": "error", "message": "Failed to update point"}), 500
    finally:
        cursor.close()
        conn.close()



#----------------------- UP PDF Predict----------------------------

@app.route('/get_pages/<subject_id>', methods=['GET'])
def get_pages(subject_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT page_no FROM Page WHERE Subject_id = %s', (subject_id,))
    pages = cursor.fetchall()
    cursor.close()
    conn.close()

    page_list = [{"page_no": page["page_no"]} for page in pages]
    return jsonify(page_list)


@app.route('/uploadExamsheet', methods=['POST'])
def upload_examsheet():
    try:
        # รับข้อมูลจากฟอร์ม
        subject_id = request.form.get("subject_id")
        page_no = request.form.get("page_no")
        file = request.files.get("file")

        if not subject_id or not page_no or not file:
            return jsonify({"success": False, "message": "ข้อมูลไม่ครบถ้วน"})
        
        # อ่าน PDF จากไฟล์ที่อัปโหลดเป็น bytes
        pdf_bytes = BytesIO(file.read())

        # สร้างโฟลเดอร์สำหรับเก็บภาพที่ปรับแล้ว
        folder_path = f'./{subject_id}/predict_img'
        os.makedirs(folder_path, exist_ok=True)

        if page_no == "allpage":
            # เรียกใช้ฟังก์ชันแปลงทุกหน้า
            result = convert_allpage(pdf_bytes, subject_id)
        else:
            # เรียกใช้ฟังก์ชันแปลงเฉพาะหน้า
            # convert_pdf(pdf_bytes, subject_id, page_no)
            result = convert_pdf(pdf_bytes, subject_id, page_no)

        # ตรวจสอบผลลัพธ์จาก result
        if not result.get("success"):
            return jsonify(result)  # ส่งข้อความ error กลับไปยัง frontend


        num_pages = len(os.listdir(folder_path))  # นับจำนวนหน้าที่ถูกบันทึกเป็นภาพ
        return jsonify({"success": True, "message": "การแปลงสำเร็จ", "num_pages": num_pages})
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"success": False, "message": str(e)})
    
#----------------------- Predict ----------------------------
stop_flag = False

@app.route('/get_sheets', methods=['GET'])
def get_sheets():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT 
            p.Page_id, 
            s.Subject_id, 
            s.Subject_name, 
            p.page_no, 
            COUNT(CASE WHEN e.score IS NOT NULL THEN 1 END) AS graded_count,
            COUNT(e.Sheet_id) AS total_count
        FROM Subject s
        JOIN Page p ON s.Subject_id = p.Subject_id
        JOIN Exam_sheet e ON p.Page_id = e.Page_id
        GROUP BY p.Page_id, s.Subject_id, s.Subject_name, p.page_no
        ORDER BY s.Subject_id, p.page_no;
    """

    cursor.execute(query)
    exam_sheets = cursor.fetchall()
    cursor.close()
    conn.close()

    response = [
        {
            "id": item["Subject_id"],
            "subject": item["Subject_name"],
            "page": item["page_no"],
            "total": f"{item['graded_count']}/{item['total_count']}",
            "Page_id": item["Page_id"]  # เพิ่ม Page_id สำหรับใช้เป็น key
        }
        for item in exam_sheets
    ]

    return jsonify(response)
 

@app.route('/start_predict', methods=['POST'])
def start_predict():
    global stop_flag
    stop_flag = False  # รีเซ็ตทุกครั้งเมื่อเริ่ม predict ใหม่
    
    data = request.get_json()
    subject_id = data.get("subject_id")
    page_no = data.get("page_no")

    if not subject_id or not page_no:
        return jsonify({"success": False, "message": "ข้อมูลไม่ครบถ้วน"}), 400

    # print(f"Received subject_id: {subject_id}, page_no: {page_no}")
    #check(subject_id, page_no, socketio)

    # สั่งให้รันงาน predict/check ใน background
    socketio.start_background_task(
        target=check,  # ชื่อฟังก์ชันที่จะรัน
        new_subject=subject_id, 
        new_page=page_no, 
        socketio=socketio
    )

    # ตอบกลับไปเลย ไม่ต้องรอ loop เสร็จ
    return jsonify({"success": True, "message": "เริ่มประมวลผลแล้ว!"}), 200

@app.route('/stop_process', methods=['POST'])
def stop_process():
    global stop_flag
    stop_flag = True
    return jsonify({"success": True, "message": "ได้รับคำสั่งหยุดการทำงานแล้ว!"})


@app.route('/get_sheets_page', methods=['GET'])
def get_sheets_by_page_id():
    try:
        # ดึงค่า subject_id และ page_no จาก request
        subject_id = request.args.get('subject_id')
        page_no = request.args.get('page_no')

        if not subject_id or not page_no:
            return jsonify({"success": False, "message": "ข้อมูลไม่ครบถ้วน"})

        # สร้าง path สำหรับโฟลเดอร์ภาพ
        folder_path = f'./{subject_id}/predict_img/{page_no}'
        
        # ตรวจสอบว่าโฟลเดอร์มีอยู่หรือไม่
        if not os.path.exists(folder_path):
            return jsonify({"success": False, "message": f"ไม่พบโฟลเดอร์: {folder_path}"})
        
        # ดึงรายการไฟล์ภาพในโฟลเดอร์และเรียงลำดับตามชื่อไฟล์ (sheet_id)
        image_files = sorted([f for f in os.listdir(folder_path) if f.endswith('.jpg') or f.endswith('.png')])

        # สร้าง URL สำหรับแต่ละไฟล์ (คุณอาจต้องแก้ไขให้ตรงกับ Static Path)
        images = [f"{subject_id}/predict_img/{page_no}/{img}" for img in image_files]
        
        return jsonify({"success": True, "images": images})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    
@app.route('/<path:filename>')
def serve_static_files(filename):
    return send_from_directory('.', filename)
        

#----------------------- Student ----------------------------
# กำหนดเส้นทางสำหรับจัดเก็บไฟล์ที่อัปโหลด
# Add Student
# UPLOAD_FOLDER = './uploads'
# os.makedirs(UPLOAD_FOLDER, exist_ok=True)
# app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def is_utf8(file_data):
    """
    ตรวจสอบว่าไฟล์เป็น UTF-8 หรือไม่
    :param file_data: ข้อมูลไฟล์ในรูปแบบ bytes
    :return: True หากเป็น UTF-8, False หากไม่ใช่
    """
    result = chardet.detect(file_data)
    encoding = result['encoding']
    print(f"Detected file encoding: {encoding}")
    return encoding.lower() == 'utf-8'

def convert_csv_to_utf8(file_data):
    """
    แปลงไฟล์ CSV ที่ไม่ใช่ UTF-8 ให้เป็น UTF-8
    :param file_data: ข้อมูลไฟล์ในรูปแบบ bytes
    :return: ข้อมูลไฟล์ที่แปลงแล้วในรูปแบบ bytes
    """
    result = chardet.detect(file_data)
    source_encoding = result['encoding']
    print(f"Detected encoding: {source_encoding}")

    # แปลงข้อมูลจาก encoding เดิมเป็น UTF-8
    file_text = file_data.decode(source_encoding)
    utf8_file_data = file_text.encode('utf-8')

    print(f"Converted from {source_encoding} to UTF-8.")
    return utf8_file_data

def process_csv(file_data, subject_id, Section):
    """
    ประมวลผลไฟล์ CSV และบันทึกข้อมูลลงฐานข้อมูล
    :param file_data: ข้อมูลไฟล์ CSV ในรูปแบบ bytes
    :param subject_id: subject_id
    :param Section: section
    """
    conn = get_db_connection()
    if conn is None:
        raise Exception("Failed to connect to the database")

    cursor = conn.cursor()

    try:
        # แปลงข้อมูลไฟล์เป็น text โดยใช้ utf-8
        file_text = file_data.decode('utf-8')
        reader = csv.reader(file_text.splitlines())
        header = next(reader)  # ข้าม header ของ CSV

        for row in reader:
            student_id = row[0].strip()
            full_name = row[1].strip()

            cursor.execute("SELECT COUNT(*) FROM Student WHERE Student_id = %s", (student_id,))
            if cursor.fetchone()[0] == 0:
                cursor.execute(
                    "INSERT INTO Student (Student_id, Full_name) VALUES (%s, %s)",
                    (student_id, full_name)
                )
                print(f"Inserted into Student: {student_id}, {full_name}")

            cursor.execute(
                """
                INSERT INTO Enrollment (Student_id, Subject_id, Section)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE Section = VALUES(Section)
                """,
                (student_id, subject_id, Section)
            )

        conn.commit()
        print("All rows processed and committed successfully.")
    except Exception as e:
        conn.rollback()
        print(f"Error processing CSV: {str(e)}")
        raise e
    finally:
        cursor.close()
        conn.close()

@app.route('/csv_upload', methods=['POST'])
def csv_upload():
    try:
        subject_id = request.form.get('subjectId')
        Section = request.form.get('Section')
        uploaded_file = request.files.get('file')

        if not subject_id or not Section or not uploaded_file:
            return jsonify({'error': 'Missing data'}), 400

        if not uploaded_file.filename.endswith('.csv'):
            return jsonify({'error': 'Invalid file type. Please upload a CSV file'}), 400

        # อ่านไฟล์ในหน่วยความจำ (memory)
        file_data = uploaded_file.read()

        # ตรวจสอบว่าไฟล์เป็น UTF-8 หรือไม่
        if is_utf8(file_data):
            # ถ้าไฟล์เป็น UTF-8 แล้ว
            process_csv(file_data, subject_id, Section)
        else:
            # ถ้าไฟล์ไม่ใช่ UTF-8
            utf8_file_data = convert_csv_to_utf8(file_data)
            process_csv(utf8_file_data, subject_id, Section)

        return jsonify({'message': 'CSV processed and data added successfully'}), 200

    except Exception as e:
        print(f"Error in csv_upload: {str(e)}")
        return jsonify({'error': str(e)}), 500




# -------------------- GET STUDENTS --------------------
@app.route('/get_students', methods=['GET'])
def get_students():
    subject_id = request.args.get('subjectId')
    Section = request.args.get('Section')

    if not subject_id:
        return jsonify({'error': 'Missing subjectId parameter'}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        if Section:
            query = """
                SELECT s.Student_id, s.Full_name, e.Section
                FROM Student s
                JOIN Enrollment e ON s.Student_id = e.Student_id
                WHERE e.Subject_id = %s AND e.Section = %s
            """
            cursor.execute(query, (subject_id, Section))
        else:
            query = """
                SELECT s.Student_id, s.Full_name, e.Section
                FROM Student s
                JOIN Enrollment e ON s.Student_id = e.Student_id
                WHERE e.Subject_id = %s
            """
            cursor.execute(query, (subject_id,))

        students = cursor.fetchall()
        return jsonify(students), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()
        
@app.route('/get_sections', methods=['GET'])
def get_sections():
    subject_id = request.args.get('subjectId')

    if not subject_id:
        return jsonify({'error': 'Missing subjectId parameter'}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        
        query = """
            SELECT DISTINCT Section
            FROM Enrollment
            WHERE Subject_id = %s
            ORDER BY Section
        """
        cursor.execute(query, (subject_id,))
        Sections = cursor.fetchall()
        return jsonify([row['Section'] for row in Sections]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()


# -------------------- DELETE STUDENT --------------------
@app.route('/delete_student/<string:student_id>', methods=['DELETE'])
def delete_student(student_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # ลบนักศึกษาที่มี Student_id ตรงกัน
        cursor.execute("DELETE FROM student WHERE Student_id = %s", (student_id,))
        conn.commit()
        if cursor.rowcount > 0:
            return jsonify({'message': 'student deleted successfully'}), 200
        else:
            return jsonify({'error': 'student not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# -------------------- EDIT STUDENT --------------------
@app.route('/edit_student', methods=['PUT'])
def edit_student():
    data = request.get_json()
    student_id = data.get('Student_id')
    full_name = data.get('Full_name')

    if not student_id or not full_name:
        return jsonify({'error': 'Missing data'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # อัปเดตชื่อของนักศึกษา
        cursor.execute(
            "UPDATE student SET Full_name = %s WHERE Student_id = %s",
            (full_name, student_id)
        )
        conn.commit()
        if cursor.rowcount > 0:
            return jsonify({'message': 'Student updated successfully'}), 200
        else:
            return jsonify({'error': 'Student not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# -------------------- COUNT STUDENT --------------------

@app.route('/get_student_count', methods=['GET'])
def get_student_count():
    subject_id = request.args.get('subject_id')  # รับ subject_id จาก frontend
    section = request.args.get('section')        # รับ section จาก frontend

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Query นับจำนวน Student_id โดยไม่กรอง Section หาก section ว่าง
        query = """
            SELECT COUNT(DISTINCT e.Student_id) AS student_count
            FROM Enrollment e
            WHERE e.Subject_id = %s
        """
        params = [subject_id]

        if section:  # กรองเฉพาะ Section ถ้าไม่ว่าง
            query += " AND e.Section = %s"
            params.append(section)

        cursor.execute(query, params)
        result = cursor.fetchone()
        student_count = result['student_count'] if result else 0

        return jsonify({"success": True, "student_count": student_count})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        cursor.close()
        conn.close()


@app.route('/update_totals', methods=['POST'])
def update_totals():
    subject_id = request.json.get('subject_id')
    section = request.json.get('section')

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # อัปเดตค่า Total ในตาราง Enrollment
        query = """
            UPDATE Enrollment e
            JOIN (
                SELECT 
                    es.Id_predict AS Student_id,
                    p.Subject_id,
                    SUM(es.Score) AS total_score
                FROM Exam_sheet es
                JOIN Page p ON es.Page_id = p.Page_id
                GROUP BY es.Id_predict, p.Subject_id
            ) t ON e.Student_id = t.Student_id AND e.Subject_id = t.Subject_id
            SET e.Total = t.total_score
            WHERE e.Subject_id = %s AND e.Section = %s;
        """
        cursor.execute(query, (subject_id, section))
        conn.commit()

        return jsonify({"success": True, "message": "Totals updated successfully."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        cursor.close()
        conn.close()

# -------------------- Score --------------------

@app.route('/get_scores_summary', methods=['GET'])
def get_scores_summary():
    subject_id = request.args.get('subject_id')
    section = request.args.get('section')

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Query หาคะแนนสูงสุด, ต่ำสุด, และค่าเฉลี่ย
        query = """
            SELECT 
                MAX(e.Total) AS max_score,
                MIN(e.Total) AS min_score,
                AVG(e.Total) AS avg_score
            FROM Enrollment e
            WHERE e.Subject_id = %s
        """
        params = [subject_id]

        if section:  # หากมี Section ให้กรอง
            query += " AND e.Section = %s"
            params.append(section)

        cursor.execute(query, params)
        result = cursor.fetchone()

        # จัดการผลลัพธ์
        scores_summary = {
            "max_score": result['max_score'] if result and result['max_score'] is not None else 0,
            "min_score": result['min_score'] if result and result['min_score'] is not None else 0,
            "avg_score": round(result['avg_score'], 2) if result and result['avg_score'] is not None else 0,
        }

        return jsonify({"success": True, "scores_summary": scores_summary})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        cursor.close()
        conn.close()



# -------------------- SD --------------------

@app.route('/get_sd', methods=['GET'])
def get_sd():
    subject_id = request.args.get('subject_id')
    
    if not subject_id:
        return jsonify({"success": False, "message": "Missing subject_id"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # ดึงข้อมูลคะแนนทั้งหมดของแต่ละ Section
        query = """
            SELECT Section, Total
            FROM Enrollment
            WHERE Subject_id = %s
        """
        cursor.execute(query, (subject_id,))
        rows = cursor.fetchall()

        # แยกคะแนนตาม Section
        section_scores = {}
        for row in rows:
            section = row['Section']
            score = row['Total']
            if section not in section_scores:
                section_scores[section] = []
            section_scores[section].append(score)

        # คำนวณค่า SD สำหรับแต่ละ Section
        section_sd = {}
        for section, scores in section_scores.items():
            if len(scores) > 1:  # ต้องมีคะแนนมากกว่า 1 สำหรับการคำนวณ SD
                mean = sum(scores) / len(scores)
                variance = sum((x - mean) ** 2 for x in scores) / (len(scores) - 1)
                sd = math.sqrt(variance)
                section_sd[section] = round(sd, 2)  # ปัดเศษทศนิยม 2 ตำแหน่ง
            else:
                section_sd[section] = 0  # หากมีคะแนนเดียว SD จะเป็น 0

        return jsonify({"success": True, "sd_per_section": section_sd})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        cursor.close()
        conn.close()
        
@app.route('/get_bell_curve', methods=['GET'])
def get_bell_curve():
    subject_id = request.args.get('subject_id')
    section = request.args.get('section')

    if not subject_id or not section:
        return jsonify({"success": False, "message": "Missing subject_id or section"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)  # ใช้ dictionary cursor

        # ดึงคะแนน Total
        query = """
            SELECT Total
            FROM Enrollment
            WHERE Subject_id = %s AND Section = %s AND Total > 0
        """
        cursor.execute(query, (subject_id, section))
        results = cursor.fetchall()

        if not results:
            return jsonify({"success": False, "message": "No scores found for this section."}), 404

        totals = [float(row['Total']) for row in results]  # ใช้ key 'Total'

        # คำนวณ Mean และ SD
        mean = sum(totals) / len(totals)
        variance = sum((x - mean) ** 2 for x in totals) / len(totals)
        sd = math.sqrt(variance)

        return jsonify({
            "success": True,
            "mean": round(mean, 2),
            "sd": round(sd, 2),
            "totals": totals
        })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        cursor.close()
        conn.close()



#----------------------- Recheck ----------------------------
# Route to find all sheet IDs for the selected subject and page
@app.route('/find_sheet', methods=['POST'])
def find_sheet():
    data = request.get_json()
    page_no = data.get("pageNo")
    subject_id = data.get("subjectId")

    if not page_no or not subject_id:
        return jsonify({"error": "Invalid input"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # Fetch Page_id
        cursor.execute('SELECT Page_id FROM Page WHERE Subject_id = %s AND Page_no = %s', (subject_id, page_no))
        page_result = cursor.fetchone()
        if not page_result:
            return jsonify({"error": "Page not found"}), 404
        now_page = page_result["Page_id"]

        # Fetch Exam_sheets
        cursor.execute('SELECT Sheet_id, Id_predict FROM Exam_sheet WHERE Page_id = %s', (now_page,))
        exam_sheets = cursor.fetchall()

        if not exam_sheets:
            return jsonify({"error": "No sheets available"}), 404

        # Prepare response
        response_data = {
            "exam_sheets": [{"Sheet_id": sheet["Sheet_id"], "Id_predict": sheet["Id_predict"]} for sheet in exam_sheets]
        }

        return jsonify(response_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()


# Route to find specific sheet details by sheet ID
@app.route('/find_sheet_by_id/<int:sheet_id>', methods=['GET'])
def find_sheet_by_id(sheet_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # Fetch the specific sheet by ID
        cursor.execute('SELECT Sheet_id, Id_predict FROM Exam_sheet WHERE Sheet_id = %s', (sheet_id,))
        exam_sheet = cursor.fetchone()

        if not exam_sheet:
            return jsonify({"error": "Sheet not found"}), 404

        # Fetch answers for the sheet
        cursor.execute('SELECT modelread, label_id FROM Answer WHERE Sheet_id = %s', (sheet_id,))
        answers = cursor.fetchall()

        answer_details = []
        for answer in answers:
            cursor.execute('SELECT No, Answer FROM label WHERE label_id = %s', (answer["label_id"],))
            label_result = cursor.fetchone()
            if label_result:
                answer_details.append({
                    "no": label_result["No"],
                    "Predict": answer["modelread"],
                    "label": label_result["Answer"]
                })

        response_data = {
            "Sheet_id": exam_sheet["Sheet_id"],
            "Id_predict": exam_sheet["Id_predict"],
            "answer_details": answer_details
        }

        return jsonify(response_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()


@app.route('/sheet_image/<int:sheet_id>', methods=['GET'])
def sheet_image(sheet_id):
    subject_id = request.args.get('subject_id')  
    page_no = request.args.get('page_no')  

    if not subject_id:
        abort(400, description="Subject ID is required")  
    if not page_no:
        abort(400, description="Page number is required")  

    # Path ของไฟล์ภาพ .jpg
    image_path = f"./{subject_id}/predict_img/{page_no}/{sheet_id}.jpg"

    # ตรวจสอบว่าไฟล์มีอยู่หรือไม่
    if not os.path.exists(image_path):
        abort(404, description="Image not found") 

    # ส่งไฟล์ภาพกลับไปที่ Front-end
    return send_file(image_path, mimetype='image/jpeg')


@app.route('/edit_predictID', methods=['POST'])
def edit_predictID():
    data = request.get_json()
    sheet_id = data.get("sheet_id")
    new_id = data.get("new_id")

    if not sheet_id or not new_id:
        return jsonify({"error": "Invalid input"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # อัปเดตค่า Id_predict ในตาราง Exam_sheet
        cursor.execute('UPDATE Exam_sheet SET Id_predict = %s WHERE Sheet_id = %s', (new_id, sheet_id))
        conn.commit()
        print(f"เปลี่ยนข้อมูลสำเร็จ: Sheet_id = {sheet_id}, Id_predict = {new_id}")  # แก้จาก Id_predict เป็น new_id

        return jsonify({"success": True})

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()

@app.route('/get_position', methods=['GET'])
def get_position():
    subject_id = request.args.get('subjectId')
    page_no = request.args.get('pageNo')
    if not subject_id or not page_no:
        return jsonify({"error": "subjectId or pageNo is missing"}), 400

    # Path สำหรับไฟล์ positions
    file_path = f"./{subject_id}/positions/positions_{page_no}.json"
    try:
        with open(file_path, 'r') as file:
            positions = json.load(file)
        return jsonify(positions), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/images/<string:subject_id>/<string:page_no>/<string:sheet_id>', methods=['GET'])
def serve_image(subject_id, page_no, sheet_id):
    image_folder = f"./{subject_id}/predict_img/{page_no}/"
    filename = f"{sheet_id}.jpg"
    return send_from_directory(image_folder, filename)









 
 
        
if __name__ == '__main__':
    # app.run(debug=True)
    socketio.run(app, host="127.0.0.1", port=5000, debug=True, use_reloader=False)
