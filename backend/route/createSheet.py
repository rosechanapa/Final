import os
import shutil
import sqlite3
from flask import Blueprint, request, jsonify
from db import get_db_connection
import sheet
from sheet import update_array, update_variable, get_images_as_base64 
import base64
from io import BytesIO
from PIL import Image


createSheet_bp = Blueprint('createSheet', __name__)
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

subject_id = 0
type_point_array = []

@createSheet_bp.route('/check_subject', methods=['POST'])
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


@createSheet_bp.route('/create_sheet', methods=['POST'])
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

@createSheet_bp.route('/submit_parts', methods=['POST'])
def submit_parts():
    global subject_id

    # สร้างโฟลเดอร์ตาม subject_id
    folder_path = os.path.join(basedir, subject_id)
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


@createSheet_bp.route('/get_images', methods=['GET'])
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

@createSheet_bp.route('/save_images', methods=['POST'])
def save_images():
    data = request.json
    base64_images = data.get('images')  # รับ base64 ของภาพจากคำขอ

    if not base64_images or not subject_id:
        return jsonify({"status": "error", "message": "No images provided or subject_id is not set"}), 400

    # สร้างโฟลเดอร์ตาม subject_id
    folder_path = os.path.join(basedir, subject_id, 'pictures')
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
            img_path = os.path.join(folder_path, f'{idx + 1}.jpg')
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

@createSheet_bp.route('/reset/<string:subject_id>', methods=['DELETE'])
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
        folder_path = os.path.join(basedir, subject_id)
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


@createSheet_bp.route('/reset_back/<string:subject_id>', methods=['DELETE'])
def reset_back(subject_id):
    global type_point_array  # ยังคงใช้ type_point_array เป็น global

    try:
        # ลบโฟลเดอร์ ./{subject_id} หากมี
        folder_path = os.path.join(basedir, subject_id)
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


@createSheet_bp.route('/reset_page', methods=['POST'])
def reset_page():
    global subject_id
    data = request.get_json()
    subject_id = data.get('subject_id')  # อัปเดต subject_id จาก request

    if subject_id is None:
        return jsonify({"status": "error", "message": "Subject ID is missing"}), 400

    # เรียกใช้ฟังก์ชัน reset() เพื่อทำการรีเซ็ต
    return reset()  # จะใช้โค้ดของ def reset() ที่กำหนดไว้