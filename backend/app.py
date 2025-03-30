import eventlet
eventlet.monkey_patch()
from flask import Flask, request, jsonify,  send_file, Response, send_from_directory , abort
from flask_cors import CORS
import base64
from io import BytesIO
import os
from PIL import Image
import sheet
from sheet import update_array, update_variable, get_images_as_base64 
import sqlite3
from db import get_db_connection
import shutil
import csv
import chardet
from flask_socketio import SocketIO, emit
from predict import convert_pdf, convert_allpage, check
import json
import math
import stop_flag
from fpdf import FPDF
import glob
import pandas as pd


# กำหนด CORS ระดับแอป (อนุญาตทั้งหมดเพื่อความง่ายใน dev)
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})


# หรือกำหนดใน SocketIO ด้วย
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# -------------------- DELETE ALL --------------------
@app.route('/delete_all', methods=['DELETE'])
def delete_all():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()

        # เริ่ม Transaction
        cursor.execute("BEGIN TRANSACTION")

        # ==================================================================================
        # ลบโฟลเดอร์ต่างๆ (หากมี)
        # ==================================================================================
        cursor.execute("SELECT Subject_id FROM Subject")
        subjects = cursor.fetchall()

        for subject in subjects:
            folder_path = f'./{subject["Subject_id"]}'
            if os.path.exists(folder_path):
                shutil.rmtree(folder_path)
                print(f"Folder {folder_path} deleted successfully.")
        
        imgcheck_path = './imgcheck'
        if os.path.exists(imgcheck_path):
            shutil.rmtree(imgcheck_path)
            print("Folder ./imgcheck deleted successfully.")
        
        # ==================================================================================
        # ลบข้อมูลในตารางทั้งหมด
        # ==================================================================================
        cursor.execute("DELETE FROM Answer")
        cursor.execute("DELETE FROM Exam_sheet")
        cursor.execute("DELETE FROM Page")
        cursor.execute("DELETE FROM Label")
        cursor.execute("DELETE FROM Group_Point")
        cursor.execute("DELETE FROM Enrollment")
        cursor.execute("DELETE FROM Student")
        cursor.execute("DELETE FROM Subject")

        # Commit การลบทั้งหมด
        conn.commit()

        return jsonify({"status": "success", "message": "All data and folders deleted successfully."})

    except sqlite3.Error as e:
        conn.rollback()  # ย้อนกลับการเปลี่ยนแปลงถ้ามี error
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        cursor.close()
        conn.close()


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
    if conn is None:
        return jsonify({"message": "Failed to connect to the database"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM Page WHERE Subject_id = ?", (subject_id,))
        result = cursor.fetchone()
        exists = result[0] > 0 if result else False
    except sqlite3.Error as e:
        return jsonify({"message": f"Database error: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

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
    choice_type_array = data.get("choice_type_array")
    

    if new_type_point_array is None:
        return jsonify({"status": "error", "message": "type_point_array is missing"}), 400
    else:
        type_point_array.extend(new_type_point_array)
        print("Updated TypePoint Array:", type_point_array)
 
    update_array(case_array, range_input_array, option_array, lines_dict_array, choice_type_array)
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
        # เริ่ม Transaction
        cursor.execute("BEGIN TRANSACTION")

        for idx, img in enumerate(images):
            # บันทึกภาพในโฟลเดอร์
            img_path = f'{folder_path}/{idx + 1}.jpg'
            img.save(img_path)
            print(f"บันทึก {img_path} สำเร็จ")

            # เพิ่มข้อมูลใน Table: Page
            cursor.execute(
                """
                INSERT INTO Page (Subject_id, Page_no)
                VALUES (?, ?)
                """,
                (subject_id, idx + 1)
            )
            print(f"เพิ่ม Page: Subject_id={subject_id}, Page_no={idx + 1} ในฐานข้อมูลสำเร็จ")

        # เพิ่มข้อมูลจาก type_point_array ในตาราง Label และ Group_Point
        group_no_mapping = {}  # ใช้เก็บ mapping ระหว่าง order และ Group_No

        # เพิ่มข้อมูลจาก type_point_array ในตาราง label
        for item in type_point_array:  # วนลูป dict ใน type_point_array
            for no, data in item.items():  # วนลูป key (No) และ value (data) ใน dict
                label_type = data.get('type')
                point = data.get('point')
                order = data.get('order')
                case_type = data.get('case')

                if label_type.lower() == 'single':
                    # เพิ่มข้อมูลใน Label สำหรับประเภท Single
                    cursor.execute(
                        """
                        INSERT INTO Label (Subject_id, No, Point_single, Type)
                        VALUES (?, ?, ?, ?)
                        """,
                        (subject_id, no, point, case_type)
                    )
                    # print(f"เพิ่มข้อมูลใน Label: Subject_id={subject_id}, No={no}, Point_single={point}, Type={case_type}")

                elif label_type.lower() == 'group':
                    # จัดการ Group_No
                    if order not in group_no_mapping:
                        # เพิ่ม Group_Point ใหม่
                        cursor.execute(
                            """
                            INSERT INTO Group_Point (Point_Group)
                            VALUES (?)
                            """,
                            (point,)
                        )
                        conn.commit()  # Commit เพื่อให้ได้ค่า AUTOINCREMENT ล่าสุด
                        group_no_mapping[order] = cursor.lastrowid  # ดึง Group_No ล่าสุด
                    group_no = group_no_mapping[order]

                    # เพิ่มข้อมูลใน Label สำหรับประเภท Group
                    cursor.execute(
                        """
                        INSERT INTO Label (Subject_id, No, Group_No, Type)
                        VALUES (?, ?, ?, ?)
                        """,
                        (subject_id, no, group_no, case_type)
                    )
                    # print(f"เพิ่มข้อมูลใน Label: Subject_id={subject_id}, No={no}, Group_No={group_no}, Type={case_type}")

        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Error: {str(e)}")
        return jsonify({"status": "error", "message": "Failed to save images or update database"}), 500
    finally:
        cursor.close()
        conn.close()

    return jsonify({"status": "success", "message": "Images saved successfully"})

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
        cursor.execute("BEGIN TRANSACTION")

        # 1. ลบข้อมูลในตาราง Answer
        cursor.execute('DELETE FROM Answer WHERE Label_id IN (SELECT Label_id FROM Label WHERE Subject_id = ?)', (subject_id,))
        # 2. ลบข้อมูลในตาราง Exam_sheet
        cursor.execute('DELETE FROM Exam_sheet WHERE Page_id IN (SELECT Page_id FROM Page WHERE Subject_id = ?)', (subject_id,))
        # 3. ลบข้อมูลในตาราง Page
        cursor.execute('DELETE FROM Page WHERE Subject_id = ?', (subject_id,))
        # 4. ลบข้อมูลในตาราง Label
        cursor.execute('DELETE FROM Label WHERE Subject_id = ?', (subject_id,))
        # 5. ลบ Group_Point ที่ไม่ได้ถูกใช้
        cursor.execute('DELETE FROM Group_Point WHERE Group_No NOT IN (SELECT DISTINCT Group_No FROM Label WHERE Group_No IS NOT NULL)')
        # 6. ลบ Answer ที่ไม่มี Label_id
        cursor.execute('DELETE FROM Answer WHERE Label_id NOT IN (SELECT DISTINCT Label_id FROM Label WHERE Label_id IS NOT NULL)')
        # 7. ลบ Exam_sheet ที่ไม่มี Sheet_id
        cursor.execute('DELETE FROM Exam_sheet WHERE Sheet_id NOT IN (SELECT DISTINCT Sheet_id FROM Answer WHERE Sheet_id IS NOT NULL)')

        # Commit การลบข้อมูล
        conn.commit()

        # ลบโฟลเดอร์ ./{subject_id} หากมี
        folder_path = f'./{subject_id}'
        if os.path.exists(folder_path):
            shutil.rmtree(folder_path)  # ลบโฟลเดอร์และไฟล์ทั้งหมดในโฟลเดอร์
            print(f"Folder {folder_path} deleted successfully.")
        else:
            print(f"Folder {folder_path} does not exist. Skipping folder deletion.")

    except sqlite3.Error as e:
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


@app.route('/reset_back/<string:subject_id>', methods=['DELETE'])
def reset_back(subject_id):
    global type_point_array  # ยังคงใช้ type_point_array เป็น global

    try:
        # ลบโฟลเดอร์ ./{subject_id} หากมี
        folder_path = f'./{subject_id}'
        if os.path.exists(folder_path):
            shutil.rmtree(folder_path)  # ลบโฟลเดอร์และไฟล์ทั้งหมดในโฟลเดอร์
            print(f"Folder {folder_path} deleted successfully.")
        else:
            print(f"Folder {folder_path} does not exist. Skipping folder deletion.")

    except Exception as e:
        return jsonify({"status": "error", "message": f"Error deleting folder: {str(e)}"}), 500

    # รีเซ็ตค่า type_point_array
    type_point_array = []
    sheet.reset()  # เรียกฟังก์ชัน reset

    return jsonify({"status": "reset done", "message": f"Reset complete for subject_id {subject_id}"}), 200

        

#----------------------- View Page ----------------------------
@app.route('/view_subjects', methods=['GET'])
def view_subjects():
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute('''
        SELECT DISTINCT s.Subject_id, s.Subject_name
        FROM Subject s
        JOIN Page p ON s.Subject_id = p.Subject_id
        WHERE p.Page_no = 1
    ''')
    
    subjects = cursor.fetchall()
    cursor.close()
    conn.close()

    subject_list = [
        {"Subject_id": subject["Subject_id"], "Subject_name": subject["Subject_name"]}
        for subject in subjects
    ]
    
    return jsonify(subject_list)

@app.route('/view_pages/<subject_id>', methods=['GET'])
def view_pages(subject_id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Database connection failed"}), 500

    try:
        conn.row_factory = sqlite3.Row  # ใช้ sqlite3.Row เพื่อให้สามารถเข้าถึงข้อมูลแบบ dictionary
        cursor = conn.cursor()

        # ดึง Page_id และ Page_no
        cursor.execute('SELECT Page_id, Page_no FROM Page WHERE Subject_id = ?', (subject_id,))
        pages = cursor.fetchall()

        page_list = [
            {
                "Page_id": page["Page_id"],  # เพิ่ม Page_id เพื่อใช้เป็น unique key
                "Page_no": page["Page_no"],
                "image_path": f"/backend/{subject_id}/pictures/{page['Page_no']}.jpg"
            }
            for page in pages
        ]

    except sqlite3.Error as e:
        return jsonify({"status": "error", "message": f"Database error: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()

    return jsonify({"status": "success", "data": page_list})


@app.route('/get_image_subject/<subject_id>/<filename>', methods=['GET'])
def get_image_subject(subject_id, filename):
    # กำหนดโฟลเดอร์ที่เก็บไฟล์
    folder_path = os.path.join(subject_id, 'pictures')  # ตัวอย่างโฟลเดอร์ ./080303103/pictures/
    file_path = os.path.join(folder_path, filename)
    # Debugging
    #print(f"Searching for file at: {file_path}")
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



#----------------------- Subject ----------------------------

@app.route('/add_subject', methods=['POST'])
def add_subject():
    data = request.json
    subject_id = data.get("Subject_id")
    subject_name = data.get("Subject_name")

    if not subject_id or not subject_name:
        return jsonify({"status": "error", "message": "Subject ID and Subject Name are required"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Failed to connect to the database"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO Subject (Subject_id, Subject_name) VALUES (?, ?)',  
            (subject_id, subject_name)
        )
        conn.commit()
        return jsonify({"status": "success", "message": "Subject added successfully"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"status": "error", "message": "Subject ID already exists"}), 400
    except sqlite3.Error as e:
        return jsonify({"status": "error", "message": f"Database error: {e}"}), 500
    finally:
        conn.close()

@app.route('/get_subjects', methods=['GET'])
def get_subjects():
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row  # ใช้ sqlite3.Row เพื่อเข้าถึงข้อมูลแบบ dictionary
    cursor = conn.cursor()
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
    
    old_subject_id = data.get("old_subject_id")  # subject_id เดิม
    new_subject_id = data.get("new_subject_id")  # subject_id ใหม่
    subject_name = data.get("subject_name")      # ชื่อวิชาใหม่

    # ตรวจสอบค่าว่าง
    if not old_subject_id or not new_subject_id or not subject_name:
        return jsonify({"message": "All fields are required"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"message": "Failed to connect to the database"}), 500

    try:
        cursor = conn.cursor()

        # เริ่ม Transaction ใน SQLite
        cursor.execute("BEGIN TRANSACTION")

        if old_subject_id != new_subject_id:
            # อัปเดต Subject_id และ Subject_name
            cursor.execute(
                '''
                UPDATE Subject
                SET Subject_id = ?, Subject_name = ?
                WHERE Subject_id = ?
                ''',
                (new_subject_id, subject_name, old_subject_id)
            )

            # Commit การเปลี่ยนแปลง
            conn.commit()

            # เปลี่ยนชื่อโฟลเดอร์
            old_folder_path = f'./{old_subject_id}'
            new_folder_path = f'./{new_subject_id}'

            # หากโฟลเดอร์เก่ามีอยู่ ให้เปลี่ยนชื่อโฟลเดอร์
            if os.path.exists(old_folder_path):
                print(f"Renaming folder {old_folder_path} to {new_folder_path}")
                os.rename(old_folder_path, new_folder_path)  # เปลี่ยนชื่อโฟลเดอร์
                print(f"Folder renamed successfully to {new_folder_path}")
            else:
                # หากไม่มีโฟลเดอร์เก่า แสดงข้อความเฉพาะใน Log แต่ไม่ทำอะไร
                print(f"Folder {old_folder_path} does not exist. Skipping folder renaming.")

        else:
            # อัปเดตเฉพาะ Subject_name
            cursor.execute(
                '''
                UPDATE Subject
                SET Subject_name = ?
                WHERE Subject_id = ?
                ''',
                (subject_name, old_subject_id)
            )
            conn.commit()

    except sqlite3.Error as e:
        conn.rollback()  # ย้อนกลับการเปลี่ยนแปลงถ้ามี error
        return jsonify({"message": f"Database Error: {str(e)}"}), 500

    except Exception as e:
        return jsonify({"message": f"Error renaming folder: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()

    return jsonify({"message": "Subject updated successfully"}), 200
 

@app.route('/delete_subject/<string:subject_id>', methods=['DELETE'])
def delete_subject(subject_id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Failed to connect to the database"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute("BEGIN TRANSACTION")

        # 1. ลบ Table: Answer
        cursor.execute('DELETE FROM Answer WHERE Label_id IN (SELECT Label_id FROM Label WHERE Subject_id = ?)', (subject_id,))

        # 2. ลบ Table: Exam_sheet
        cursor.execute('DELETE FROM Exam_sheet WHERE Page_id IN (SELECT Page_id FROM Page WHERE Subject_id = ?)', (subject_id,))

        # 3. ลบ Table: Page
        cursor.execute('DELETE FROM Page WHERE Subject_id = ?', (subject_id,))

        # 4. ลบ Table: Label
        cursor.execute('DELETE FROM Label WHERE Subject_id = ?', (subject_id,))

        # 5. ลบ Table: Enrollment
        cursor.execute('DELETE FROM Enrollment WHERE Subject_id = ?', (subject_id,))

        # 6. ลบ Table: Subject
        cursor.execute('DELETE FROM Subject WHERE Subject_id = ?', (subject_id,))

        # 7. ลบ Group_No ที่ไม่ได้ใช้
        cursor.execute('DELETE FROM Group_Point WHERE Group_No NOT IN (SELECT DISTINCT Group_No FROM Label WHERE Group_No IS NOT NULL)')

        # 8. ลบ Student_id ที่ไม่ได้ใช้
        cursor.execute('DELETE FROM Student WHERE Student_id NOT IN (SELECT DISTINCT Student_id FROM Enrollment)')

        # 9. ลบ Label_id ที่ไม่ได้ใช้
        cursor.execute('DELETE FROM Answer WHERE Label_id NOT IN (SELECT DISTINCT Label_id FROM Label WHERE Label_id IS NOT NULL)')

        # 10. ลบ Sheet_id ที่ไม่ได้ใช้
        cursor.execute('DELETE FROM Exam_sheet WHERE Sheet_id NOT IN (SELECT DISTINCT Sheet_id FROM Answer WHERE Sheet_id IS NOT NULL)')

        # Commit การลบข้อมูลทั้งหมด
        conn.commit()

        # 11. ลบโฟลเดอร์ที่เกี่ยวข้อง
        folder_path = f'./{subject_id}'
        if os.path.exists(folder_path):
            shutil.rmtree(folder_path)
            print(f"Folder {folder_path} deleted successfully.")
        else:
            print(f"Folder {folder_path} does not exist. Skipping folder deletion.")

        check_path = f'./imgcheck/{subject_id}'
        if os.path.exists(check_path):
            shutil.rmtree(check_path)
            print(f"Folder {check_path} deleted successfully.")
        else:
            print(f"Folder {check_path} does not exist. Skipping folder deletion.")

    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"status": "error", "message": f"Database Error: {str(e)}"}), 500

    except Exception as e:
        return jsonify({"status": "error", "message": f"Error deleting folder: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()

    return jsonify({"status": "success", "message": "Subject and related data deleted successfully"}), 200
   

#----------------------- UP PDF Predict ----------------------------
@app.route('/get_pages/<subject_id>', methods=['GET'])
def get_pages(subject_id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Database connection failed"}), 500

    try:
        conn.row_factory = sqlite3.Row  # ใช้ sqlite3.Row เพื่อให้สามารถเข้าถึงข้อมูลแบบ dictionary
        cursor = conn.cursor()

        cursor.execute('SELECT Page_no FROM Page WHERE Subject_id = ?', (subject_id,))
        pages = cursor.fetchall()

        page_list = [{"page_no": page["Page_no"]} for page in pages]

    except sqlite3.Error as e:
        return jsonify({"status": "error", "message": f"Database error: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()

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
            result = convert_pdf(pdf_bytes, subject_id, page_no)

        # ตรวจสอบผลลัพธ์จาก result
        if not result.get("success"):
            return jsonify(result)  # ส่งข้อความ error กลับไปยัง frontend


        num_pages = len(os.listdir(folder_path))  # นับจำนวนหน้าที่ถูกบันทึกเป็นภาพ
        return jsonify({"success": True, "message": "การแปลงสำเร็จ", "num_pages": num_pages})
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"success": False, "message": str(e)})
 
@app.route('/delete_file', methods=['DELETE'])
def delete_file():
    conn = None
    cursor = None
    try:
        data = request.get_json()
        subject_id = data.get('subject_id')
        page_no = data.get('page_no')

        if not subject_id or not page_no:
            return jsonify({"success": False, "message": "ข้อมูลไม่ครบถ้วน"}), 400

        # เชื่อมต่อฐานข้อมูล
        conn = get_db_connection()
        if conn is None:
            return jsonify({"success": False, "message": "Database connection failed"}), 500
        cursor = conn.cursor()

        # 1. ค้นหา Page_id ในตาราง Page จาก Subject_id และ Page_no
        cursor.execute(
            "SELECT Page_id FROM Page WHERE Subject_id = ? AND Page_no = ?",
            (subject_id, page_no)
        )
        page_id_row = cursor.fetchone()
        if not page_id_row:
            return jsonify({"success": False, "message": "ไม่พบ Page_id"}), 404

        now_page = page_id_row[0]

        # 2. ค้นหา Sheet_id ที่มี Page_id == now_page 
        cursor.execute(
            "SELECT Sheet_id FROM Exam_sheet WHERE Page_id = ?",
            (now_page,)
        )
        sheet_id_rows = cursor.fetchall()
        if not sheet_id_rows:
            return jsonify({"success": False, "message": "ไม่พบ Sheet_id ที่ Page_id นี้"}), 404

        # 3. ลบไฟล์ภาพและลบข้อมูลในฐานข้อมูลสำหรับ Sheet_id ที่พบ
        deleted_files = []
        failed_files = []
        for sheet_id_row in sheet_id_rows:
            sheet_id = sheet_id_row[0]

            # ลบข้อมูลจาก Answer
            cursor.execute("DELETE FROM Answer WHERE Sheet_id = ?", (sheet_id,))

            # ตรวจสอบว่า Sheet_id ยังอยู่ใน Answer หรือไม่
            cursor.execute("SELECT COUNT(*) FROM Answer WHERE Sheet_id = ?", (sheet_id,))
            count = cursor.fetchone()[0]

            # ถ้าไม่มีการอ้างอิงใน Answer แล้ว ค่อยลบออกจาก Exam_sheet
            if count == 0:
                cursor.execute("DELETE FROM Exam_sheet WHERE Sheet_id = ?", (sheet_id,))

            # ลบไฟล์ภาพ
            file_path = f"./{subject_id}/predict_img/{page_no}/{sheet_id}.jpg"
            try:
                os.remove(file_path)
                deleted_files.append(file_path)
            except FileNotFoundError:
                failed_files.append(file_path)

        # ลบโฟลเดอร์หลังจากลบไฟล์ทั้งหมด
        folder_path = f"./{subject_id}/predict_img/{page_no}"
        if os.path.exists(folder_path) and os.path.isdir(folder_path):
            try:
                shutil.rmtree(folder_path)
            except Exception as e:
                print(f"ไม่สามารถลบโฟลเดอร์ {folder_path} ได้: {str(e)}")

        check_path = f'./imgcheck/{subject_id}/{page_no}'
        if os.path.exists(check_path):
            shutil.rmtree(check_path)
            print(f"Folder {check_path} deleted successfully.")
        else:
            print(f"Folder {check_path} does not exist. Skipping folder deletion.")

        conn.commit()

        return jsonify({
            "success": True,
            "message": "ลบข้อมูลและไฟล์สำเร็จ",
            "deleted_files": deleted_files,
            "failed_files": failed_files
        }), 200

    except sqlite3.Error as e:
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": f"เกิดข้อผิดพลาด: {str(e)}"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

#----------------------- Predict ----------------------------

@app.route('/get_sheets', methods=['GET'])
def get_sheets():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Database connection failed"}), 500

    try:
        conn.row_factory = sqlite3.Row  # ใช้ sqlite3.Row เพื่อให้สามารถเข้าถึงข้อมูลแบบ dictionary
        cursor = conn.cursor()

        query = """
            SELECT 
                p.Page_id, 
                s.Subject_id, 
                s.Subject_name, 
                p.Page_no, 
                COUNT(CASE WHEN e.Id_predict IS NOT NULL THEN 1 END) AS graded_count,
                COUNT(e.Sheet_id) AS total_count
            FROM Subject s
            JOIN Page p ON s.Subject_id = p.Subject_id
            JOIN Exam_sheet e ON p.Page_id = e.Page_id
            GROUP BY p.Page_id, s.Subject_id, s.Subject_name, p.Page_no
            ORDER BY s.Subject_id, p.Page_no;
        """

        cursor.execute(query)
        exam_sheets = cursor.fetchall()

        response = [
            {
                "id": item["Subject_id"],
                "subject": item["Subject_name"],
                "page": item["Page_no"],
                "total": f"{item['graded_count']}/{item['total_count']}",
                "Page_id": item["Page_id"]  # เพิ่ม Page_id สำหรับใช้เป็น key
            }
            for item in exam_sheets
        ]

    except sqlite3.Error as e:
        return jsonify({"status": "error", "message": f"Database error: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()

    return jsonify(response)
 
@app.route('/stop_process', methods=['POST'])
def stop_process():
    stop_flag.stop_flag = True
    try:
        socketio.emit('process_stopped', {'message': 'Process stopped successfully'})
    except Exception as e:
        print(f"Error emitting socket event: {e}")
    return jsonify({"success": True, "message": "ได้รับคำสั่งหยุดการทำงานแล้ว!"})

@app.route('/start_predict', methods=['POST'])
def start_predict():
    stop_flag.stop_flag = False  # รีเซ็ตค่า stop_flag
    
    data = request.get_json()
    subject_id = data.get("subject_id")
    page_no = data.get("page_no")

    if not subject_id or not page_no:
        return jsonify({"success": False, "message": "ข้อมูลไม่ครบถ้วน"}), 400

    # โดยเราจะต้องส่ง socketio เข้าไปด้วย เพื่อที่ใน cal_score จะ emit กลับมาได้
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

@app.route('/find_paper', methods=['POST'])
def find_paper():
    data = request.get_json()
    page_id = data.get('Page_id')

    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Database connection failed"}), 500

    try:
        conn.row_factory = sqlite3.Row  # ใช้ sqlite3.Row เพื่อให้สามารถเข้าถึงข้อมูลแบบ dictionary
        cursor = conn.cursor()

        query = """
            SELECT 
                p.Subject_id, 
                p.Page_no, 
                e.Sheet_id,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 
                        FROM Answer a 
                        WHERE a.Sheet_id = e.Sheet_id
                    ) THEN 1
                    ELSE 0
                END AS is_answered
            FROM Page p
            JOIN Exam_sheet e ON p.Page_id = e.Page_id
            WHERE p.Page_id = ?
        """
        cursor.execute(query, (page_id,))
        results = cursor.fetchall()

        response = [
            {
                "Subject_id": row["Subject_id"],
                "Page_no": row["Page_no"],
                "Sheet_id": row["Sheet_id"],
                "is_answered": bool(row["is_answered"])  # แปลงค่าเป็น Boolean
            }
            for row in results
        ]

    except sqlite3.Error as e:
        return jsonify({"status": "error", "message": f"Database error: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()

    return jsonify(response)


@app.route('/delete_paper', methods=['POST'])
def delete_paper():
    data = request.get_json()
    sheet_id = data.get('Sheet_id')
    subject_id = data.get('Subject_id')
    page_no = data.get('Page_no')

    if not sheet_id or not subject_id or not page_no:
        return jsonify({"error": "Sheet_id, Subject_id, and Page_no are required"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()

        # ลบข้อมูลในตาราง Answer
        cursor.execute("DELETE FROM Answer WHERE Sheet_id = ?", (sheet_id,))

        # ตรวจสอบว่ามีการอ้างอิง Sheet_id อยู่ใน Answer หรือไม่
        cursor.execute("SELECT COUNT(*) AS count FROM Answer WHERE Sheet_id = ?", (sheet_id,))
        count = cursor.fetchone()[0]

        # ถ้าไม่มีการอ้างอิง ให้ลบจาก Exam_sheet
        if count == 0:
            cursor.execute("DELETE FROM Exam_sheet WHERE Sheet_id = ?", (sheet_id,))

        # สร้าง path สำหรับลบภาพโดยใช้ Subject_id และ Page_no จาก frontend
        image_path = f'./{subject_id}/predict_img/{page_no}/{sheet_id}.jpg'

        try:
            import os
            if os.path.exists(image_path):
                os.remove(image_path)
                print(f"Deleted image file: {image_path}")
            else:
                print(f"Image file not found: {image_path}")
        except Exception as e:
            print(f"Error deleting image file: {str(e)}")

        conn.commit()
        return jsonify({"message": "ลบข้อมูลสำเร็จ"})
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/check_data', methods=['POST'])
def check_data():
    data = request.get_json()
    page_id = data.get('Page_id')

    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Database connection failed"}), 500

    try:
        conn.row_factory = sqlite3.Row  # ใช้ sqlite3.Row เพื่อให้สามารถเข้าถึงข้อมูลแบบ dictionary
        cursor = conn.cursor()

        # ค้นหา Subject_id จากตาราง Page
        cursor.execute("SELECT Subject_id FROM Page WHERE Page_id = ?", (page_id,))
        result = cursor.fetchone()
        if not result:
            return jsonify({'CheckData': False})  # ไม่พบ Page_id

        subject_id = result["Subject_id"]

        # ตรวจสอบ Answer ในตาราง Label โดยไม่รวม Type = '6' และ Type = 'free'
        query = """
        SELECT COUNT(*) AS NullCount
        FROM Label
        WHERE Subject_id = ? AND Answer IS NULL AND Type != '6' AND Type != 'free'
        """
        cursor.execute(query, (subject_id,))
        label_result = cursor.fetchone()

        # CheckData = True ถ้าไม่มี Answer ที่เป็น NULL สำหรับ Type != '6' และ Type != 'free'
        check_data = label_result[0] == 0
        return jsonify({'CheckData': check_data})

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
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # Fetch Page_id
        cursor.execute('SELECT Page_id FROM Page WHERE Subject_id = ? AND Page_no = ?', (subject_id, page_no))
        page_result = cursor.fetchone()
        if not page_result:
            return jsonify({"error": "Page not found"}), 404
        now_page = page_result["Page_id"]

        # Fetch Exam_sheets
        cursor.execute('''
            SELECT Sheet_id, Id_predict, Status 
            FROM Exam_sheet 
            WHERE Page_id = ? 
            ORDER BY Status ASC, Sheet_id ASC
        ''', (now_page,))
        exam_sheets = cursor.fetchall()

        if not exam_sheets:
            return jsonify({"error": "No sheets available"}), 404

        # Prepare response
        response_data = {
            "exam_sheets": [
                {
                    "Sheet_id": sheet["Sheet_id"],
                    "Id_predict": sheet["Id_predict"],
                    "status": sheet["Status"]
                } for sheet in exam_sheets
            ]
        }

        return jsonify(response_data)

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()

@app.route('/cleanup_duplicate_answers/<int:sheet_id>', methods=['POST'])
def cleanup_duplicate_answers(sheet_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            WITH duplicates AS (
                SELECT MIN(Ans_id) as keep_id
                FROM Answer
                WHERE Sheet_id = ?
                GROUP BY Label_id
            )
            DELETE FROM Answer
            WHERE Sheet_id = ?
              AND Ans_id NOT IN (SELECT keep_id FROM duplicates)
        """, (sheet_id, sheet_id))

        conn.commit()
        return jsonify({"message": "Duplicates removed successfully"})

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()



# Route to find specific sheet details by sheet ID
@app.route('/find_sheet_by_id/<int:sheet_id>', methods=['GET'])
def find_sheet_by_id(sheet_id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # ดึงข้อมูลของชีทตาม ID ที่ระบุ
        cursor.execute('SELECT Page_id, Score, Sheet_id, Id_predict, Status FROM Exam_sheet WHERE Sheet_id = ?', (sheet_id,))
        exam_sheet = cursor.fetchone()

        if not exam_sheet:
            return jsonify({"error": "ไม่พบชีท"}), 404

        # ค้นหา Subject_id จาก Page โดยใช้ Page_id
        cursor.execute('SELECT Subject_id FROM Page WHERE Page_id = ?', (exam_sheet["Page_id"],))
        page_info = cursor.fetchone()
        subject_id = page_info["Subject_id"] if page_info else None

        # ตรวจสอบว่า Id_predict อยู่ใน Enrollment.Student_id ที่มี Subject_id ตรงกันหรือไม่
        same_id = 0  # ค่าเริ่มต้นคือไม่ตรง
        if subject_id:
            cursor.execute(
                'SELECT 1 FROM Enrollment WHERE Student_id = ? AND Subject_id = ?',
                (exam_sheet["Id_predict"], subject_id)
            )
            same_id = 1 if cursor.fetchone() else 0

        # ดึงคำตอบสำหรับชีทนี้
        cursor.execute('SELECT Ans_id, Score_point, Modelread, Label_id FROM Answer WHERE Sheet_id = ?', (sheet_id,))
        answers = cursor.fetchall()

        answer_details = []
        group_points_added = set()  # ติดตาม Group_No ที่เพิ่มแล้ว

        for answer in answers:
            cursor.execute('SELECT No, Answer, Type, Group_No, Point_single, Free FROM Label WHERE Label_id = ?', (answer["Label_id"],))
            label_result = cursor.fetchone()

            if label_result:
                # ดึงข้อมูล Point_Group หากมี Group_No
                point_group = None
                if label_result["Group_No"] is not None:
                    if label_result["Group_No"] not in group_points_added:
                        cursor.execute('SELECT Point_Group FROM Group_Point WHERE Group_No = ?', (label_result["Group_No"],))
                        group_point_result = cursor.fetchone()
                        if group_point_result:
                            point_group = float(group_point_result["Point_Group"])
                            group_points_added.add(label_result["Group_No"])

                # กำหนดค่า Type_score ตามเงื่อนไข
                type_score = float(label_result["Point_single"]) if label_result["Point_single"] is not None else (point_group if point_group is not None else "")

                answer_details.append({
                    "no": label_result["No"],
                    "Predict": answer["Modelread"],
                    "label": label_result["Answer"],
                    "score_point": answer["Score_point"],
                    "type": label_result["Type"],
                    "free": label_result["Free"],
                    "Type_score": type_score,
                    "Ans_id": answer["Ans_id"]
                })

        response_data = {
            "Sheet_id": exam_sheet["Sheet_id"],
            "Id_predict": exam_sheet["Id_predict"],
            "score": exam_sheet["Score"],
            "status": exam_sheet["Status"],
            "same_id": same_id,  
            "answer_details": answer_details
        }

        return jsonify(response_data)

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()

@app.route('/update_modelread/<Ans_id>', methods=['PUT'])
def update_modelread(Ans_id):
    data = request.json  # รับข้อมูล JSON ที่ส่งมาจาก frontend
    modelread = data.get('modelread')  # รับค่าที่ต้องการแก้ไข
    print(f"Received Ans_id: {Ans_id}, modelread: '{modelread}'")

    if modelread is None:  # อนุญาตค่าว่าง
        return jsonify({"status": "error", "message": "Invalid modelread value"}), 400

    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({"status": "error", "message": "Database connection failed"}), 500

        cursor = conn.cursor()

        # อัปเดตข้อมูลในตาราง Answer
        sql = """
            UPDATE Answer
            SET Modelread = ?
            WHERE Ans_id = ?
        """
        cursor.execute(sql, (modelread, Ans_id))
        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({"status": "error", "message": "No record found for this Ans_id"}), 404

        return jsonify({"status": "success", "message": "Answer updated successfully"})

    except sqlite3.Error as e:
        print(f"Error updating answer: {e}")
        return jsonify({"status": "error", "message": "Failed to update answer"}), 500

    finally:
        cursor.close()
        conn.close()
        

@app.route('/cal_scorepage', methods=['POST'])
def cal_scorepage():
    data = request.json
    ans_id = data.get('Ans_id')
    subject_id = data.get('Subject_id')

    if not ans_id or not subject_id:
        return jsonify({"status": "error", "message": "Ans_id and Subject_id are required."}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Database connection failed."}), 500

    try:
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # (1) หา Sheet_id จาก Ans_id
        cursor.execute('SELECT Sheet_id FROM Answer WHERE Ans_id = ?', (ans_id,))
        sheet_row = cursor.fetchone()
        if not sheet_row:
            return jsonify({"status": "error", "message": "Sheet_id not found for the given Ans_id."}), 404
        sheet_id = sheet_row["Sheet_id"]

        # (2) ดึงข้อมูล Answer ทั้งหมดใน Sheet_id นี้
        cursor.execute('''
            SELECT a.Ans_id, a.Label_id, a.Modelread, a.Score_point,
                   l.Answer, l.Point_single, l.Group_No, gp.Point_Group, l.Type, l.Free
            FROM Answer a
            JOIN Label l ON a.Label_id = l.Label_id
            LEFT JOIN Group_Point gp ON l.Group_No = gp.Group_No
            WHERE a.Sheet_id = ?
        ''', (sheet_id,))
        answers = cursor.fetchall()

        sum_score = 0
        group_answers = {}  # เก็บข้อมูลแต่ละกลุ่มรูปแบบ: group_no: [ (row...), ... ]
        checked_groups = set()

        for row in answers:
            ans_id       = row["Ans_id"]
            ans_type     = row["Type"]
            modelread_str = str(row["Modelread"] or "")
            answer_str   = str(row["Answer"] or "")
            group_no     = row["Group_No"]
            point_group  = row["Point_Group"]
            point_single = row["Point_single"]
            score_point  = row["Score_point"]
            free         = row["Free"]

            # ---- 1) Type = 'free' ----
            if free == 1:
                if point_single is not None:
                    sum_score += point_single
                elif group_no is not None and group_no not in checked_groups:
                    # ให้คะแนนเฉพาะครั้งแรกในกลุ่ม
                    if point_group is not None:
                        sum_score += point_group
                        checked_groups.add(group_no)
                continue

            # ---- 2) Type = '6' ----
            if ans_type == "6":
                # ถ้ามี score_point อยู่แล้วก็บวกเลย
                if score_point is not None:
                    sum_score += score_point
                continue

            # ---- 3) Type = '3' และอื่นๆ ----
            # ตรวจว่ามี Group_No หรือไม่
            if group_no is not None:
                # เก็บไว้ตรวจภายหลัง (ตรวจเป็น "กลุ่ม")
                if group_no not in group_answers:
                    group_answers[group_no] = []
                group_answers[group_no].append(row)
            else:
                # กรณี type=3 "เดี่ยว" (ไม่อยู่ในกลุ่ม)
                if ans_type == "3" and answer_str:
                    # (เพิ่ม) เงื่อนไข: ถ้า answer_str มี '.' => ใช้ startswith
                    if '.' in answer_str:
                        if modelread_str.startswith(answer_str):
                            # อัปเดต Modelread เป็น answer_str
                            cursor.execute('UPDATE Answer SET Modelread=? WHERE Ans_id=?', (answer_str, ans_id))
                            # บวกคะแนน point_single
                            if point_single is not None:
                                sum_score += point_single
                                # อัปเดต Answer.Score_point = point_single
                                cursor.execute('''
                                    UPDATE Answer
                                    SET Score_point = ?
                                    WHERE Ans_id = ?
                                ''', (point_single, ans_id))
                        else:
                            # ไม่ตรง prefix => ให้ใช้ score_point ถ้ามี
                            if score_point is not None:
                                sum_score += score_point
                    else:
                        # ถ้าไม่มี '.' => ต้องตรงกัน (==)
                        if modelread_str == answer_str:
                            if point_single is not None:
                                sum_score += point_single
                                cursor.execute('''
                                    UPDATE Answer
                                    SET Score_point = ?
                                    WHERE Ans_id = ?
                                ''', (point_single, ans_id))
                        else:
                            # ไม่ตรง => ใช้ score_point
                            if score_point is not None:
                                sum_score += score_point

                else:
                    # เงื่อนไขเดิม (ไม่ใช่ type=3 หรือ answer_str ว่าง)
                    # เช่นเทียบตรงแบบ case-insensitive
                    if modelread_str.lower() == answer_str.lower() and point_single is not None:
                        sum_score += point_single

        # ---- 4) ตรวจสอบ "กลุ่ม" ----
        for g_no, rows_in_group in group_answers.items():
            if g_no not in checked_groups:
                all_correct = True

                # (4.1) ตรวจทุกแถวในกลุ่ม
                for row in rows_in_group:
                    ans_id       = row["Ans_id"]
                    ans_type     = row["Type"]
                    modelread_str = str(row["Modelread"] or "")
                    answer_str   = str(row["Answer"] or "")
                    point_group  = row["Point_Group"]

                    if ans_type == "3" and answer_str:
                        if '.' in answer_str:
                            # ถ้ามี '.' => must startswith
                            if not modelread_str.startswith(answer_str):
                                all_correct = False
                                break
                            else:
                                # อัปเดต Modelread
                                cursor.execute('UPDATE Answer SET Modelread=? WHERE Ans_id=?', (answer_str, ans_id))
                        else:
                            # ไม่มี '.' => ต้อง == เป๊ะ
                            if modelread_str != answer_str:
                                all_correct = False
                                break
                           
                    else:
                        # กรณี type อื่น => เทียบตรง lower
                        if modelread_str.lower() != answer_str.lower():
                            all_correct = False
                            break

                # (4.2) สรุปคะแนนกลุ่ม
                if all_correct:
                    # เพิ่มคะแนน Point_Group
                    pg = rows_in_group[0]["Point_Group"]  # ใช้ของแถวแรก
                    if pg is not None:
                        sum_score += pg

                        # (เพิ่ม) อัปเดต Score_point = Point_Group ให้ "แถวแรก" ในกลุ่ม
                        first_ans_id = rows_in_group[0]["Ans_id"]
                        cursor.execute('''
                            UPDATE Answer
                            SET Score_point = ?
                            WHERE Ans_id = ?
                        ''', (pg, first_ans_id))
                else:
                    # ไม่ถูกทั้งหมด 
                    # และอัปเดต Score_point = 0 สำหรับแถวแรก หรือทุกแถวตามต้องการ
                    first_ans_id = rows_in_group[0]["Ans_id"]
                    cursor.execute('''
                        UPDATE Answer
                        SET Score_point = 0
                        WHERE Ans_id = ?
                    ''', (first_ans_id,))

                checked_groups.add(g_no)

        # ---- 5) อัปเดต Score ของ sheet_id ใน Exam_sheet
        cursor.execute('''
            UPDATE Exam_sheet
            SET Score = ?
            WHERE Sheet_id = ?
        ''', (sum_score, sheet_id))
        conn.commit()

        # ---- 6) อัปเดตคะแนนรวมในตาราง Enrollment
        cursor.execute('''
            UPDATE Enrollment
            SET Total = (
                SELECT COALESCE(SUM(es.Score), 0)
                FROM Exam_sheet es
                JOIN Page p ON es.Page_id = p.Page_id
                WHERE es.Id_predict = Enrollment.Student_id
                  AND p.Subject_id = Enrollment.Subject_id
            )
            WHERE Subject_id = ?
        ''', (subject_id,))
        conn.commit()

        return jsonify({"status": "success", "message": "Scores calculated and updated successfully."})

    except sqlite3.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        cursor.close()
        conn.close()



@app.route('/update_scorepoint/<Ans_id>', methods=['PUT'])
def update_scorepoint(Ans_id):
    data = request.json  # รับข้อมูล JSON ที่ส่งมาจาก frontend
    score_point = data.get('score_point')  # รับค่าที่ต้องการแก้ไข
    print(f"Received Ans_id: {Ans_id}, score_point: {score_point}")

    # ตรวจสอบว่า score_point ไม่เป็น None หรือค่าว่าง
    if score_point is None or str(score_point).strip() == "":
        return jsonify({"status": "error", "message": "Invalid score_point value"}), 400

    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({"status": "error", "message": "Database connection failed"}), 500

        cursor = conn.cursor()

        # ดึงค่า Score_point เก่าจากฐานข้อมูล
        select_sql = "SELECT Score_point FROM Answer WHERE Ans_id = ?"
        cursor.execute(select_sql, (Ans_id,))
        record = cursor.fetchone()

        # หากไม่มีข้อมูล Ans_id นี้ในตาราง Answer
        if not record:
            return jsonify({"status": "error", "message": "No record found for this Ans_id"}), 404

        old_score = record[0]  # ค่าที่อยู่ในฐานข้อมูลเดิม
        new_score = float(score_point)  # แปลงค่าใหม่เป็น float เพื่อเปรียบเทียบ

        # ตรวจสอบว่าค่าใหม่เท่ากับค่าเดิมหรือไม่
        if old_score is not None and float(old_score) == new_score:
            return jsonify({
                "status": "success",
                "message": "No changes were made because the score_point is the same."
            }), 200

        # หากค่าใหม่ไม่เท่ากับค่าเดิม จึงทำการ UPDATE
        update_sql = """
            UPDATE Answer
            SET Score_point = ?
            WHERE Ans_id = ?
        """
        cursor.execute(update_sql, (score_point, Ans_id))
        conn.commit()

        # ตรวจสอบว่ามีการอัปเดตแถวหรือไม่
        if cursor.rowcount == 0:
            return jsonify({"status": "error", "message": "No record found for this Ans_id"}), 404

        return jsonify({"status": "success", "message": "Answer updated successfully"}), 200

    except sqlite3.Error as e:
        print(f"Error updating answer: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        cursor.close()
        conn.close()



@app.route('/sheet_image/<int:sheet_id>', methods=['GET'])
def sheet_image(sheet_id):
    subject_id = request.args.get('subject_id')  # รับ subject_id จาก query string
    page_no = request.args.get('page_no')  # รับ page_no จาก query string

    if not subject_id:
        abort(400, description="Subject ID is required")  # ส่ง error 400 ถ้าไม่มี subject_id
    if not page_no:
        abort(400, description="Page number is required")  # ส่ง error 400 ถ้าไม่มี page_no

    # Path ของไฟล์ภาพ .jpg
    image_path = f"./{subject_id}/predict_img/{page_no}/{sheet_id}.jpg"

    # ตรวจสอบว่าไฟล์มีอยู่หรือไม่
    if not os.path.exists(image_path):
        abort(404, description="Image not found")  # ส่ง error 404 ถ้าไม่มีไฟล์ภาพ

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
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()

        # อัปเดตค่า Id_predict ในตาราง Exam_sheet
        cursor.execute('UPDATE Exam_sheet SET Id_predict = ? WHERE Sheet_id = ?', (new_id, sheet_id))
        conn.commit()
        #print(f"เปลี่ยนข้อมูลสำเร็จ: Sheet_id = {sheet_id}, Id_predict = {new_id}")

        return jsonify({"success": True})

    except sqlite3.Error as e:
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

@app.route('/get_imgcheck', methods=['POST'])
def get_imgcheck():
    try:
        exam_sheet_id = request.form.get('examSheetId')
        subject_id = request.form.get('subjectId')
        page_no = request.form.get('pageNo')  # ดึงค่า page_no จากคำขอ
        image = request.files.get('image')

        if not exam_sheet_id or not subject_id or not page_no or not image:
            print(f"Invalid data: exam_sheet_id={exam_sheet_id}, subject_id={subject_id}, page_no={page_no}, image={image}")
            return jsonify({"error": "ข้อมูลไม่ครบถ้วน"}), 400

        # ปรับเส้นทางการบันทึกภาพ
        save_path = f"./imgcheck/{subject_id}/{page_no}/{exam_sheet_id}.jpg"
        os.makedirs(os.path.dirname(save_path), exist_ok=True)

        if os.path.exists(save_path):
            print(f"ไฟล์ {save_path} มีอยู่แล้ว จะทำการเขียนทับไฟล์เดิม")
        else:
            print(f"สร้างไฟล์ใหม่ที่ {save_path}")

        # ตรวจสอบก่อนบันทึกไฟล์
        if image:
            image.save(save_path)
            print(f"บันทึกไฟล์สำเร็จ: {save_path}")
        else:
            print(f"ไม่พบไฟล์ภาพสำหรับบันทึก: {image}")
            return jsonify({"error": "ไม่พบไฟล์ภาพ"}), 400

        conn = get_db_connection()
        if conn is None:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = conn.cursor()

        cursor.execute('''
            UPDATE Exam_sheet
            SET Status = 1
            WHERE Sheet_id = ?
        ''', (exam_sheet_id,))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"message": "บันทึกภาพและอัปเดตสถานะสำเร็จ"}), 200

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์"}), 500

@app.route('/cal_enroll', methods=['POST'])
def cal_enroll():
    data = request.json
    sheet_id = data.get('Sheet_id')
    subject_id = data.get('Subject_id')

    if not sheet_id or not subject_id:
        return jsonify({"status": "error", "message": "sheet_id and Subject_id are required."}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Database connection failed."}), 500

    try:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # (1) ดึง Answer ทั้งหมดของ Sheet ที่ระบุ
        cursor.execute('''
            SELECT a.Ans_id, a.Label_id, a.Modelread, a.Score_point,
                   l.Answer, l.Point_single, l.Group_No, gp.Point_Group, l.Type, l.Free
            FROM Answer a
            JOIN Label l ON a.Label_id = l.Label_id
            LEFT JOIN Group_Point gp ON l.Group_No = gp.Group_No
            WHERE a.Sheet_id = ?
        ''', (sheet_id,))
        answers = cursor.fetchall()

        if not answers:
            return jsonify({"status": "error", "message": "No answers found."}), 404

        sum_score = 0

        # เก็บ "แถวในกลุ่ม" และ "แถวที่ไม่อยู่ในกลุ่ม" แยกกัน
        group_answers = {}     # { group_no: [row1, row2, ...], ... }
        non_group_answers = [] # list ของแถวที่ group_no เป็น None
        for row in answers:
            if row["Group_No"] is not None:
                g_no = row["Group_No"]
                if g_no not in group_answers:
                    group_answers[g_no] = []
                group_answers[g_no].append(row)
            else:
                non_group_answers.append(row)

        # =========================
        # (A) ตรวจคำตอบที่ "ไม่อยู่ในกลุ่ม"
        # =========================
        for row in non_group_answers:
            ans_id       = row["Ans_id"]
            ans_type     = row["Type"]
            modelread_str = str(row["Modelread"] or "")
            answer_str   = str(row["Answer"]    or "")
            point_single = row["Point_single"]
            score_point  = row["Score_point"]
            free         = row["Free"]

            # --1) กรณี type=free --
            if free == 1:
                if point_single is not None:
                    sum_score += point_single
                    # ถ้าต้องการเซต Score_point ใน Answer
                    cursor.execute('''
                        UPDATE Answer
                        SET Score_point = ?
                        WHERE Ans_id = ?
                    ''', (point_single, ans_id))
                continue

            # --2) กรณี type=6 --
            if ans_type == '6':
                # ตัวอย่าง: สมมติถ้ามี score_point เดิม ก็เอานั้นเลย
                if score_point is not None:
                    sum_score += score_point
                # หรือจะตั้ง score_point = 0 เสมอก็ได้
                continue

            # --3) กรณี type=3 (ไม่อยู่ในกลุ่ม)--
            if ans_type == '3' and answer_str:
                if '.' in answer_str:
                    # มีจุด => ใช้ startswith
                    if modelread_str.startswith(answer_str):
                        # อัปเดต Modelread = Answer
                        cursor.execute('''
                            UPDATE Answer
                            SET Modelread = ?
                            WHERE Ans_id = ?
                        ''', (answer_str, ans_id))

                        # บวกคะแนนตาม point_single
                        if point_single is not None:
                            sum_score += point_single
                            # อัปเดต Score_point
                            cursor.execute('''
                                UPDATE Answer
                                SET Score_point = ?
                                WHERE Ans_id = ?
                            ''', (point_single, ans_id))
                    else:
                        # ไม่ผ่านเงื่อนไข => ใช้ score_point ถ้ามี
                        if score_point is not None:
                            sum_score += score_point
                else:
                    # ไม่มีจุด => ต้อง == เป๊ะ
                    if modelread_str == answer_str:
                        if point_single is not None:
                            sum_score += point_single
                            # อัปเดต Score_point
                            cursor.execute('''
                                UPDATE Answer
                                SET Score_point = ?
                                WHERE Ans_id = ?
                            ''', (point_single, ans_id))
                    else:
                        if score_point is not None:
                            sum_score += score_point
                continue

            # --4) กรณี Type อื่น ๆ --
            # สมมติเทียบตรงแบบ lowercase
            modelread_lower = modelread_str.lower()
            answer_lower    = answer_str.lower()
            if modelread_lower == answer_lower and point_single is not None:
                sum_score += point_single
                cursor.execute('''
                    UPDATE Answer
                    SET Score_point = ?
                    WHERE Ans_id = ?
                ''', (point_single, ans_id))

        # =========================
        # (B) ตรวจ "กลุ่ม" (group_no != None)
        # =========================
        checked_groups = set()
        for g_no, rows_in_group in group_answers.items():
            if g_no in checked_groups:
                continue

            all_correct = True

            for row in rows_in_group:
                ans_type     = row["Type"]
                ans_id       = row["Ans_id"]
                modelread_str = str(row["Modelread"] or "")
                answer_str   = str(row["Answer"]    or "")

                # หากเป็น type=3
                if ans_type == '3' and answer_str:
                    if '.' in answer_str:
                        if not modelread_str.startswith(answer_str):
                            all_correct = False
                            break
                        else:
                            # อัปเดต Modelread
                            cursor.execute('''
                                UPDATE Answer
                                SET Modelread = ?
                                WHERE Ans_id = ?
                            ''', (answer_str, ans_id))
                    else:
                        if modelread_str != answer_str:
                            all_correct = False
                            break

                else:
                    # type อื่น => เทียบตรงแบบ lower
                    if modelread_str.lower() != answer_str.lower():
                        all_correct = False
                        break

            # สรุปผลกลุ่ม
            if all_correct:
                # บวก Point_Group
                p_group = rows_in_group[0]["Point_Group"]  # สมมติใช้ค่าเดียวกัน
                if p_group is not None:
                    sum_score += p_group

                    # อัปเดต Score_point ของ "แถวแรก" ในกลุ่ม
                    first_ans_id = rows_in_group[0]["Ans_id"]
                    cursor.execute('''
                        UPDATE Answer
                        SET Score_point = ?
                        WHERE Ans_id = ?
                    ''', (p_group, first_ans_id))
            else:
                # ไม่ถูกทั้งหมด => ตั้ง Score_point = 0 (ตัวอย่างเฉพาะแถวแรก)
                first_ans_id = rows_in_group[0]["Ans_id"]
                cursor.execute('''
                    UPDATE Answer
                    SET Score_point = 0
                    WHERE Ans_id = ?
                ''', (first_ans_id,))

            checked_groups.add(g_no)

        # (C) อัปเดตคะแนน sum_score ลงใน Exam_sheet
        cursor.execute('''
            UPDATE Exam_sheet
            SET Score = ?
            WHERE Sheet_id = ?
        ''', (sum_score, sheet_id))
        conn.commit()

        # (D) คำนวณคะแนนรวมใน Enrollment
        cursor.execute('''
            UPDATE Enrollment
            SET Total = (
                SELECT COALESCE(SUM(es.Score), 0)
                FROM Exam_sheet es
                JOIN Page p ON es.Page_id = p.Page_id
                WHERE es.Id_predict = Enrollment.Student_id
                  AND p.Subject_id = Enrollment.Subject_id
            )
            WHERE Subject_id = ?
        ''', (subject_id,))
        conn.commit()

        return jsonify({"status": "success", "message": "Scores calculated and updated successfully."})

    except sqlite3.Error as e:
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        cursor.close()
        conn.close()



#----------------------- View Recheck ----------------------------
@app.route('/get_listpaper', methods=['POST'])
def get_listpaper():
    data = request.json
    subject_id = data.get('subjectId')
    page_no = data.get('pageNo')

    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        print(f"Debug: subject_id={subject_id}, page_no={page_no}")

        # ดึง Page_id สำหรับ Subject_id และ Page_no ที่ระบุ
        cursor.execute('SELECT Page_id FROM Page WHERE Page_no = ? AND Subject_id = ?', (page_no, subject_id))
        page = cursor.fetchone()

        if not page:
            return jsonify({"error": "ไม่พบหน้ากระดาษ"}), 404

        page_id = page["Page_id"]

        # ดึงข้อมูล Exam_sheet สำหรับ Page_id ที่ระบุและ Status = 1
        cursor.execute('SELECT Sheet_id, Score, Id_predict FROM Exam_sheet WHERE Page_id = ? AND Status=1', (page_id,))
        exam_sheets = cursor.fetchall()

        if not exam_sheets:
            return jsonify({"error": "ไม่พบข้อมูลชีทคำตอบ"}), 404

        results = []

        for exam_sheet in exam_sheets:
            results.append({
                "Sheet_id": exam_sheet["Sheet_id"],
                "score": exam_sheet["Score"],
                "Id_predict": exam_sheet["Id_predict"],
            })

        return jsonify(results)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()


@app.route('/show_imgcheck', methods=['GET'])
def show_imgcheck():
    subject_id = request.args.get('subjectId')
    page_no = request.args.get('pageNo')
    sheet_id = request.args.get('sheetId')

    # ตรวจสอบว่ามีพารามิเตอร์ครบหรือไม่
    if not subject_id or not page_no or not sheet_id:
        return jsonify({"error": "Missing subjectId, pageNo, or sheetId"}), 400

    # สร้าง path สำหรับไฟล์รูปภาพ
    image_path = os.path.join('./imgcheck', subject_id, page_no, f"{sheet_id}.jpg")

    # ตรวจสอบว่าไฟล์มีอยู่จริงหรือไม่
    if not os.path.exists(image_path):
        return jsonify({"error": "Image not found"}), 404

    try:
        # ส่งไฟล์รูปภาพกลับไป
        return send_file(image_path, mimetype='image/jpeg')
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    
@app.route('/download_paper/<subject_id>/<pageno>/<sheet_id>', methods=['GET'])
def download_paper(subject_id, pageno, sheet_id):
    file_path = f'./imgcheck/{subject_id}/{pageno}/{sheet_id}.jpg'
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    else:
        return jsonify({"status": "error", "message": "Image not found"}), 404
    
    
@app.route('/download_paperpdf/<subject_id>/<pageno>', methods=['GET'])
def download_paperpdf(subject_id, pageno):
    folder_path = f'./imgcheck/{subject_id}/{pageno}'  # โฟลเดอร์เก็บภาพ
    images = sorted(glob.glob(f"{folder_path}/*.jpg"))  # ดึงรูปทั้งหมดในโฟลเดอร์
    
    if not images:
        return jsonify({"status": "error", "message": "No images found"}), 404
    
    pdf = FPDF()
    for img_path in images:
        pdf.add_page()
        pdf.image(img_path, x=5, y=5, w=200)  # ปรับตำแหน่งและขนาดภาพ
    
    pdf_output_path = os.path.join(folder_path, "combined.pdf")
    pdf.output(pdf_output_path)
    
    if os.path.exists(pdf_output_path):
        return send_file(pdf_output_path, as_attachment=True, download_name=f"{subject_id}_{pageno}.pdf")
    else:
        return jsonify({"status": "error", "message": "PDF generation failed"}), 500


#----------------------- Label ----------------------------
@app.route('/get_labels/<subject_id>', methods=['GET'])
def get_labels(subject_id):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT 
                l.Label_id, 
                l.No, 
                l.Answer, 
                l.Point_single, 
                l.Group_No, 
                gp.Point_Group,
                l.Type,
                l.Free
            FROM Label l
            LEFT JOIN Group_Point gp ON l.Group_No = gp.Group_No
            WHERE l.Subject_id = ?
            ORDER BY l.No
            """,
            (subject_id,)
        )

        rows = cursor.fetchall()

        # แปลงข้อมูลเป็น dictionary
        labels = [dict(row) for row in rows]

        return jsonify({"status": "success", "data": labels})
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
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # อัปเดตข้อมูลในตาราง Label
        cursor.execute(
            """
            UPDATE Label
            SET Answer = ?
            WHERE Label_id = ?
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
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # ตรวจสอบ Group_No จาก label_id
        cursor.execute("SELECT Group_No FROM Label WHERE Label_id = ?", (label_id,))
        result = cursor.fetchone()

        if result is None:
            return jsonify({"status": "error", "message": "Label_id not found"}), 404

        group_no = result["Group_No"]

        if group_no is None:
            # กรณี Group_No เป็น null
            cursor.execute(
                """
                UPDATE Label
                SET Point_single = ?
                WHERE Label_id = ?
                """,
                (point, label_id)
            )
        else:
            # กรณี Group_No ไม่เป็น null
            cursor.execute(
                """
                UPDATE Group_Point
                SET Point_Group = ?
                WHERE Group_No = ?
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

@app.route('/update_free/<label_id>', methods=['PUT'])
def update_free(label_id):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # ตรวจสอบว่า Label_id มี Group_No หรือไม่
        cursor.execute(
            """
            SELECT Group_No
            FROM Label
            WHERE Label_id = ?
            """,
            (label_id,)
        )
        result = cursor.fetchone()

        if result and result["Group_No"]:  # ใช้ชื่อคอลัมน์แทน index
            # หาก Group_No ไม่เป็น NULL
            group_no = result["Group_No"]

            # อัปเดต Label ที่มี Group_No เดียวกัน
            cursor.execute(
                """
                UPDATE Label
                SET Free = 1
                WHERE Group_No = ?
                """,
                (group_no,)
            )
        else:
            # หาก Group_No เป็น NULL
            cursor.execute(
                """
                UPDATE Label
                SET Free = 1
                WHERE Label_id = ?
                """,
                (label_id,)
            )

        conn.commit()

        return jsonify({"status": "success", "message": "Free status updated successfully"})
    except Exception as e:
        print(f"Error updating Free column: {e}")
        return jsonify({"status": "error", "message": "Failed to update Free status"}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/cancel_free', methods=['POST'])
def cancel_free():
    data = request.json

    label_id = data.get('label_id')

    if not label_id:
        return jsonify({"status": "error", "message": "Invalid input"}), 400

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # ตรวจสอบ Group_No ของ Label_id ที่ระบุ
        cursor.execute(
            """
            SELECT Group_No
            FROM Label
            WHERE Label_id = ?
            """,
            (label_id,)
        )
        result = cursor.fetchone()

        if result and result["Group_No"]:
            group_no = result["Group_No"]

            # อัปเดต Free = 0 สำหรับทั้งกลุ่ม
            cursor.execute(
                """
                UPDATE Label
                SET Free = 0
                WHERE Group_No = ?
                """,
                (group_no,)
            )
        else:
            # อัปเดต Free = 0 เฉพาะ Label เดียว
            cursor.execute(
                """
                UPDATE Label
                SET Free = 0
                WHERE Label_id = ?
                """,
                (label_id,)
            )

        conn.commit()

        return jsonify({"status": "success", "message": "Free status updated successfully"})
    except Exception as e:
        print(f"Error updating Free column: {e}")
        return jsonify({"status": "error", "message": "Failed to update Free status"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/update_Check', methods=['POST'])
def update_Check():
    data = request.json
    subject_id = data.get('Subject_id')

    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # 1) หา Page_id ที่ตรงกับ Subject_id
        cursor.execute('''
            SELECT Page_id
            FROM Page
            WHERE Subject_id = ?
        ''', (subject_id,))
        temp_page = [row["Page_id"] for row in cursor.fetchall()]

        # 2) หา Sheet_id จาก Page_id
        sheet = []
        for page_id in temp_page:
            cursor.execute('''
                SELECT Sheet_id
                FROM Exam_sheet
                WHERE Page_id = ?
            ''', (page_id,))
            sheet += [row["Sheet_id"] for row in cursor.fetchall()]

        # 3) คำนวณคะแนนในแต่ละ Sheet
        for sheet_id in sheet:
            cursor.execute('''
                SELECT a.Ans_id, a.Label_id, a.Modelread, a.Score_point,
                       l.Answer, l.Point_single, l.Group_No, gp.Point_Group, l.Type, l.Free
                FROM Answer a
                JOIN Label l ON a.Label_id = l.Label_id
                LEFT JOIN Group_Point gp ON l.Group_No = gp.Group_No
                WHERE a.Sheet_id = ?
            ''', (sheet_id,))
            answers = cursor.fetchall()

            sum_score = 0
            group_answers = {}  # { group_no: [(ans_id, modelread_str, answer_str, point_group, type, point_single), ...] }
            checked_groups = set()

            for row in answers:
                ans_id       = row["Ans_id"]
                ans_type     = row["Type"]
                modelread_str = str(row["Modelread"]) if row["Modelread"] else ""
                answer_str   = str(row["Answer"]) if row["Answer"] else ""
                group_no     = row["Group_No"]
                point_group  = row["Point_Group"]
                point_single = row["Point_single"]
                score_point  = row["Score_point"]
                free         = row["Free"]

                # -------------------- (1) Type = 'free' --------------------
                if free == 1:  
                    if point_single is not None:
                        sum_score += point_single
                    elif group_no is not None and group_no not in checked_groups:
                        if point_group is not None:
                            sum_score += point_group
                            checked_groups.add(group_no)
                    continue

                # -------------------- (2) Type = '6' --------------------
                if ans_type == '6' and score_point is not None:
                    sum_score += score_point
                    continue

                # -------------------- (3) กรณีอื่น ๆ (รวมถึง type = '3') --------------------
                if group_no is not None:
                    # เก็บไว้ตรวจหลัง loop
                    if group_no not in group_answers:
                        group_answers[group_no] = []
                    group_answers[group_no].append((
                        ans_id, modelread_str, answer_str, point_group, ans_type, point_single
                    ))
                else:
                    # กรณีไม่อยู่ในกลุ่ม -> ตรวจเป็นแถว
                    if ans_type == '3' and answer_str:
                        # ถ้าต้องการตรวจว่ามี '.' => ใช้ startswith
                        if '.' in answer_str:
                            # ถ้า modelread_str ขึ้นต้นด้วย answer_str
                            if modelread_str.startswith(answer_str):
                                # อัปเดต Modelread ให้เป็น Answer
                                cursor.execute('UPDATE Answer SET Modelread=? WHERE Ans_id=?', (answer_str, ans_id))
                                # ให้คะแนนตาม point_single
                                if point_single is not None:
                                    sum_score += point_single
                                    # อัปเดต Score_point ในตาราง Answer ให้เท่ากับ point_single
                                    update_answer_query = '''
                                        UPDATE Answer
                                        SET Score_point = ?
                                        WHERE Ans_id = ?
                                    '''
                                    cursor.execute(update_answer_query, (point_single, ans_id))
                            else:
                                # กรณีไม่ตรง prefix
                                if score_point is not None:
                                    sum_score += score_point
                        else:
                            # ถ้าไม่มี '.' => ต้อง == เป๊ะ
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
                            else:
                                if score_point is not None:
                                    sum_score += score_point

                    else:
                        # กรณีไม่ใช่ type=3 หรือ answer_str ว่าง -> เทียบตรง
                        if modelread_str.lower() == answer_str.lower() and point_single is not None:
                            sum_score += point_single

            # -------------------- (4) ตรวจสอบคะแนนในกลุ่ม --------------------
            for g_no, ans_list in group_answers.items():
                if g_no not in checked_groups:
                    # ans_list => [ (ans_id, m_str, a_str, p_group, ans_type, p_single), ... ]
                    all_correct = True

                    for (aid, m_str, a_str, p_group, a_type, p_single) in ans_list:
                        if a_type == '3' and a_str:
                            if '.' in a_str:
                                if not m_str.startswith(a_str):
                                    all_correct = False
                                    break
                                else:
                                    # อัปเดต modelread
                                    cursor.execute('UPDATE Answer SET Modelread=? WHERE Ans_id=?', (a_str, aid))
                            else:
                                # ไม่มี '.' => ต้อง == เป๊ะ
                                if m_str != a_str:
                                    all_correct = False
                                    break
                        else:
                            # type อื่น => ใช้เทียบตรงพิมพ์เล็ก
                            if m_str.lower() != a_str.lower():
                                all_correct = False
                                break

                    if all_correct:
                        # ถ้าในกลุ่มนี้ถูกทุกแถว => บวก Point_Group
                        p_group = ans_list[0][3]  # ตัวแรกในกลุ่ม (point_group)
                        if p_group is not None:
                            sum_score += p_group

                            # เพิ่มเติม: อัปเดต Score_point ให้แถวแรกในกลุ่มด้วย
                            # สมมติเราเลือกแถวแรกเป็นตัวแทน
                            first_ans_id = ans_list[0][0]  # ans_id ของตัวแรก
                            cursor.execute('''
                                UPDATE Answer
                                SET Score_point = ?
                                WHERE Ans_id = ?
                            ''', (p_group, first_ans_id))
                    else:
                        # กรณีไม่ถูกทั้งหมด 
                        # สมมติอยากอัปเดต Score_point ของแถวแรก (หรือทุกแถว) ในกลุ่มให้เป็น 0
                        first_ans_id = ans_list[0][0]
                        cursor.execute('''
                            UPDATE Answer
                            SET Score_point = 0
                            WHERE Ans_id = ?
                        ''', (first_ans_id,))

                    checked_groups.add(g_no)

            # อัปเดตคะแนนรวมในตาราง Exam_sheet
            cursor.execute('''
                UPDATE Exam_sheet
                SET Score = ?
                WHERE Sheet_id = ?
            ''', (sum_score, sheet_id))
            conn.commit()

        # 5) อัปเดตคะแนนรวมในตาราง Enrollment
        cursor.execute('''
            UPDATE Enrollment
            SET Total = (
                SELECT SUM(es.Score)
                FROM Exam_sheet es
                JOIN Page p ON es.Page_id = p.Page_id
                WHERE es.Id_predict = Enrollment.Student_id
                  AND p.Subject_id = Enrollment.Subject_id
            )
            WHERE Subject_id = ?
        ''', (subject_id,))
        conn.commit()

        return jsonify({"status": "success", "message": "Scores calculated and updated successfully."})

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)})

    finally:
        cursor.close()
        conn.close()



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
    ประมวลผลไฟล์ CSV และบันทึกข้อมูลลงฐานข้อมูล SQLite
    :param file_data: ข้อมูลไฟล์ CSV ในรูปแบบ bytes
    :param subject_id: subject_id
    :param Section: section
    """
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
    cursor = conn.cursor()

    try:
        # แปลงข้อมูลไฟล์เป็น text โดยใช้ utf-8
        file_text = file_data.decode('utf-8')
        reader = csv.reader(file_text.splitlines())
        header = next(reader)  # ข้าม header ของ CSV

        for row in reader:
            student_id = row[1].strip().replace('-', '')  # เปลี่ยนจาก row[0]
            full_name = row[2].strip()   # เปลี่ยนจาก row[1]

            # ตรวจสอบว่ามี Student อยู่หรือไม่
            cursor.execute("SELECT COUNT(*) FROM Student WHERE Student_id = ?", (student_id,))
            if cursor.fetchone()[0] == 0:
                cursor.execute(
                    "INSERT INTO Student (Student_id, Full_name) VALUES (?, ?)",
                    (student_id, full_name)
                )
                print(f"Inserted into Student: {student_id}, {full_name}")

            # SQLite ไม่รองรับ ON DUPLICATE KEY UPDATE โดยตรง จึงใช้ REPLACE แทน
            cursor.execute(
                """
                INSERT INTO Enrollment (Student_id, Subject_id, Section)
                VALUES (?, ?, ?)
                ON CONFLICT(Student_id, Subject_id) 
                DO UPDATE SET Section = excluded.Section
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


def process_excel(df, subject_id, Section):
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        for _, row in df.iterrows():
            student_id = str(row['student_id']).strip()
            full_name = str(row['full_name']).strip()

            cursor.execute("SELECT COUNT(*) FROM Student WHERE Student_id = ?", (student_id,))
            if cursor.fetchone()[0] == 0:
                cursor.execute(
                    "INSERT INTO Student (Student_id, Full_name) VALUES (?, ?)",
                    (student_id, full_name)
                )

            cursor.execute(
                """
                INSERT INTO Enrollment (Student_id, Subject_id, Section)
                VALUES (?, ?, ?)
                ON CONFLICT(Student_id, Subject_id) 
                DO UPDATE SET Section = excluded.Section
                """,
                (student_id, subject_id, Section)
            )

        conn.commit()
        print("Excel rows processed and committed successfully.")
    except Exception as e:
        conn.rollback()
        print(f"Error processing Excel: {str(e)}")
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

        filename = uploaded_file.filename

        if filename.endswith('.csv'):
            file_data = uploaded_file.read()
            if is_utf8(file_data):
                process_csv(file_data, subject_id, Section)
            else:
                utf8_file_data = convert_csv_to_utf8(file_data)
                process_csv(utf8_file_data, subject_id, Section)

        elif filename.endswith('.xlsx'):
            df = pd.read_excel(uploaded_file)

            # ตรวจสอบว่ามีอย่างน้อย 3 คอลัมน์
            if df.shape[1] < 3:
                return jsonify({'error': 'Excel file must have at least 3 columns'}), 400

            # ใช้คอลัมน์ตำแหน่งแทนชื่อคอลัมน์
            df['student_id'] = df.iloc[:, 1].astype(str).str.strip().str.replace('-', '', regex=False)
            df['full_name'] = df.iloc[:, 2].astype(str).str.strip()

            process_excel(df, subject_id, Section)

        else:
            return jsonify({'error': 'Invalid file type. Please upload a CSV or XLSX file'}), 400

        return jsonify({'message': 'File processed and data added successfully'}), 200

    except Exception as e:
        print(f"Error in csv_upload: {str(e)}")
        return jsonify({'error': str(e)}), 500

# -------------------- GET STUDENTS --------------------
@app.route('/get_students', methods=['GET'])
def get_students():
    subject_id = request.args.get('subjectId')
    section = request.args.get('Section')  # ใช้ section ให้สอดคล้องกับการตั้งชื่อตัวแปร

    if not subject_id:
        return jsonify({'error': 'Missing subjectId parameter'}), 400

    conn = get_db_connection()
    conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
    cursor = conn.cursor()

    try:
        if section:
            query = """
                SELECT s.Student_id, s.Full_name, e.Section, e.Total
                FROM Student s
                JOIN Enrollment e ON s.Student_id = e.Student_id
                WHERE e.Subject_id = ? AND e.Section = ?
            """
            cursor.execute(query, (subject_id, section))
        else:
            query = """
                SELECT s.Student_id, s.Full_name, e.Section, e.Total
                FROM Student s
                JOIN Enrollment e ON s.Student_id = e.Student_id
                WHERE e.Subject_id = ?
            """
            cursor.execute(query, (subject_id,))

        students = [dict(row) for row in cursor.fetchall()]  # แปลงผลลัพธ์เป็น JSON ที่อ่านง่าย
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
    conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
    cursor = conn.cursor()

    try:
        
        query = """
            SELECT DISTINCT Section
            FROM Enrollment
            WHERE Subject_id = ?
            ORDER BY Section
        """
        cursor.execute(query, (subject_id,))
        sections = [row["Section"] for row in cursor.fetchall()]  # ดึงค่า Section ออกมาเป็น list

        return jsonify(sections), 200
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
        cursor.execute("DELETE FROM Student WHERE Student_id = ?", (student_id,))
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

@app.route('/delete_students', methods=['POST'])
def delete_students():
    conn = None
    cursor = None
    try:
        data = request.json
        subject_id = data.get('subject_id')
        section = data.get('section')

        conn = get_db_connection()
        cursor = conn.cursor()

        # ลบจาก Enrollment
        cursor.execute("""
            DELETE FROM Enrollment
            WHERE Subject_id = ? AND Section = ?
        """, (subject_id, section))

        # ลบนักเรียนที่ไม่มีใน Enrollment แล้ว
        cursor.execute("""
            DELETE FROM Student
            WHERE Student_id NOT IN (
                SELECT Student_id FROM Enrollment
            )
        """)

        conn.commit()
        return jsonify({'message': 'Deleted successfully'}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({'error': str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# -------------------- EDIT STUDENT --------------------
@app.route('/edit_student', methods=['PUT'])
def edit_student():
    data = request.json
    old_student_id = data.get('oldStudentId')
    new_student_id = data.get('newStudentId')
    full_name = data.get('Full_name')
    section = data.get('Section')

    if not old_student_id or not new_student_id or not full_name or not section:
        return jsonify({"error": "Invalid input"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # เริ่ม transaction ใน SQLite
        cursor.execute("BEGIN TRANSACTION")

        # อัปเดตข้อมูลในตาราง Student
        student_query = """
            UPDATE Student 
            SET Student_id = ?, Full_name = ?
            WHERE Student_id = ?
        """
        cursor.execute(student_query, (new_student_id, full_name, old_student_id))

        # อัปเดตข้อมูลในตาราง Enrollment
        enrollment_query = """
            UPDATE Enrollment 
            SET Student_id = ?, Section = ?
            WHERE Student_id = ?
        """
        cursor.execute(enrollment_query, (new_student_id, section, old_student_id))

        # Commit การเปลี่ยนแปลง
        conn.commit()
        return jsonify({"message": "Student and Enrollment updated successfully!"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()

# -------------------- COUNT STUDENT --------------------

@app.route('/get_student_count', methods=['GET'])
def get_student_count():
    subject_id = request.args.get('subject_id') 
    section = request.args.get('section')      

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้เข้าถึงข้อมูลผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # Query นับจำนวน Student_id โดยไม่กรอง Section หาก section ว่าง
        query = """
            SELECT COUNT(DISTINCT e.Student_id) AS student_count
            FROM Enrollment e
            WHERE e.Subject_id = ?
        """
        params = [subject_id]

        if section:  # กรองเฉพาะ Section ถ้าไม่ว่าง
            query += " AND e.Section = ?"
            params.append(section)

        cursor.execute(query, params)
        result = cursor.fetchone()
        student_count = result["student_count"] if result else 0

        return jsonify({"success": True, "student_count": student_count})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/update_totals', methods=['POST'])
def update_totals():
    subject_id = request.json.get('subject_id')
    section = request.json.get('section')

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ใช้ row_factory เพื่อเข้าถึงคอลัมน์ผ่านชื่อ
        cursor = conn.cursor()

        # อัปเดตค่า Total ในตาราง Enrollment
        query = """
            SELECT es.Id_predict AS Student_id, SUM(es.Score) AS total_score
            FROM Exam_sheet es
            JOIN Page p ON es.Page_id = p.Page_id
            WHERE p.Subject_id = ? 
            GROUP BY es.Id_predict
        """
        cursor.execute(query, (subject_id,))
        total_scores = cursor.fetchall()

        # อัปเดตค่า Total ในตาราง Enrollment
        for row in total_scores:
            student_id = row["Student_id"]
            total_score = row["total_score"]

            update_query = """
                UPDATE Enrollment 
                SET Total = ?
                WHERE Student_id = ? AND Subject_id = ? AND Section = ?
            """
            cursor.execute(update_query, (total_score, student_id, subject_id, section))

        conn.commit()

        return jsonify({"success": True, "message": "Totals updated successfully."})

    except Exception as e:
        conn.rollback()  # ยกเลิกการเปลี่ยนแปลงหากเกิดข้อผิดพลาด
        return jsonify({"success": False, "message": str(e)}), 500

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
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์
        cursor = conn.cursor()

        # Query หาคะแนนสูงสุด, ต่ำสุด, และค่าเฉลี่ย
        query = """
            SELECT 
                MAX(e.Total) AS max_score,
                MIN(e.Total) AS min_score,
                AVG(e.Total) AS avg_score
            FROM Enrollment e
            WHERE e.Subject_id = ?
        """
        params = [subject_id]

        if section:  # หากมี Section ให้กรอง
            query += " AND e.Section = ?"
            params.append(section)

        cursor.execute(query, params)
        result = cursor.fetchone()

        # จัดการผลลัพธ์
        scores_summary = {
            "max_score": result["max_score"] if result["max_score"] is not None else 0,
            "min_score": result["min_score"] if result["min_score"] is not None else 0,
            "avg_score": round(result["avg_score"], 2) if result["avg_score"] is not None else 0,
        }

        return jsonify({"success": True, "scores_summary": scores_summary})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

        
@app.route('/get_bell_curve', methods=['GET'])
def get_bell_curve():
    subject_id = request.args.get('subject_id')
    section = request.args.get('section')  # Optional parameter

    if not subject_id:
        return jsonify({"success": False, "message": "Missing subject_id"}), 400

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์
        cursor = conn.cursor()

        if section:
            # Query คะแนนเฉพาะ Section
            query = """
                SELECT Total
                FROM Enrollment
                WHERE Subject_id = ? AND Section = ? AND Total > 0
            """
            cursor.execute(query, (subject_id, section))
        else:
            # Query คะแนนของทุก Section ใน Subject นั้น
            query = """
                SELECT Total
                FROM Enrollment
                WHERE Subject_id = ? AND Total > 0
            """
            cursor.execute(query, (subject_id,))

        results = cursor.fetchall()

        if not results:
            message = "No scores found for this section." if section else "No scores found for this subject."
            return jsonify({"success": False, "message": message}), 404

        # ดึงคะแนนทั้งหมด
        totals = [float(row["Total"]) for row in results]

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


@app.route('/get_total_score', methods=['GET'])
def get_total_score():
    subject_id = request.args.get('subject_id')

    if not subject_id:
        return jsonify({"success": False, "message": "Missing subject_id"}), 400

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้ผลลัพธ์สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # คำนวณคะแนนเต็มจาก Point_single และ Point_group
        query = """
            SELECT 
                 COALESCE(SUM(l.Point_single), 0) AS total_single,
                 (
                    SELECT COALESCE(SUM(gp.Point_group), 0)
                    FROM Group_point gp
                    WHERE gp.Group_no IN (
                       SELECT DISTINCT l.Group_no
                       FROM Label l
                       WHERE l.Subject_id = ?
                       AND l.Group_no IS NOT NULL
                    )
                ) AS total_group
            FROM Label l
            WHERE l.Subject_id = ?
        """
        cursor.execute(query, (subject_id, subject_id))
        result = cursor.fetchone()

        total_score = result["total_single"] + (result["total_group"] or 0)

        return jsonify({
            "success": True,
            "total_score": total_score
        })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        cursor.close()
        conn.close()


@app.route('/get_summary', methods=['GET'])
def get_summary():
    subject_id = request.args.get('subject_id')

    if not subject_id:
        return jsonify({"error": "Missing subject_id"}), 400

    try:
        # Connect to the database
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # ดึง Label_id, No, และ Type ของข้อสอบในวิชานั้น
        cursor.execute("SELECT Label_id, No, Type FROM Label WHERE Subject_id = ?", (subject_id,))
        label_data = cursor.fetchall()

        # กรอง Label_id ที่ไม่ใช่ Type '3', '6', และ 'free'
        total_dict = {}
        valid_label_ids = []
        for label in label_data:
            if label["Type"] not in ("3", "6", "free"):
                total_dict[label["Label_id"]] = {"no": label["No"], "max_total": 0}
                valid_label_ids.append(label["Label_id"])

        if not valid_label_ids:
            return jsonify({"error": "No valid labels found"}), 400

        # ดึง Modelread จาก Answer ที่ Label_id อยู่ใน valid_label_ids
        format_strings = ",".join("?" * len(valid_label_ids))
        cursor.execute(f"""
            SELECT Answer.Label_id, Answer.Modelread, Label.Answer 
            FROM Answer 
            JOIN Label ON Answer.Label_id = Label.Label_id
            WHERE Answer.Label_id IN ({format_strings})
        """, tuple(valid_label_ids))
        answer_data = cursor.fetchall()

        # ตรวจสอบคำตอบ (ให้คำตอบตัวเล็กหรือตัวใหญ่ก็ได้)
        for ans in answer_data:
            if ans["Modelread"].strip().lower() == ans["Answer"].strip().lower():
                total_dict[ans["Label_id"]]["max_total"] += 1

        # จัดลำดับ key ตามค่ามากสุดและน้อยสุด
        sorted_total = sorted(total_dict.items(), key=lambda x: x[1]["max_total"], reverse=True)
        top_max = [{"no": value["no"], "correct_count": value["max_total"]} for _, value in sorted_total[:5]]
        top_low = [
            {"no": value["no"], "correct_count": value["max_total"]}
            for _, value in sorted_total[-5:]
            if value["no"] not in [item["no"] for item in top_max]
        ]

        return jsonify({"top_max_no": top_max, "top_low_no": top_low})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/get_score_chart', methods=['GET'])
def get_score_distribution():
    subject_id = request.args.get('subject_id')
    section = request.args.get('section')  # Optional

    if not subject_id:
        return jsonify({"success": False, "message": "Missing subject_id"}), 400

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        if section:
            query = """
                SELECT Total
                FROM Enrollment
                WHERE Subject_id = ? AND Section = ? AND Total > 0
            """
            cursor.execute(query, (subject_id, section))
        else:
            query = """
                SELECT Total
                FROM Enrollment
                WHERE Subject_id = ? AND Total > 0
            """
            cursor.execute(query, (subject_id,))

        results = cursor.fetchall()
        if not results:
            return jsonify({"success": False, "message": "No scores found."}), 404

        # สร้าง dict นับจำนวนของแต่ละคะแนน
        score_counts = {}
        for row in results:
            score = int(row["Total"])
            score_counts[score] = score_counts.get(score, 0) + 1

        return jsonify({
            "success": True,
            "distribution": score_counts
        })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        cursor.close()
        conn.close()



if __name__ == "__main__":
    socketio.run(app, host="127.0.0.1", port=5000, debug=True, use_reloader=False)