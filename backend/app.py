from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import base64
from io import BytesIO
import os
from PIL import Image
import sheet
from sheet import update_array, update_variable, get_images_as_base64 , reset
from db import get_db_connection
import subprocess
import csv
import shutil
from decimal import Decimal


app = Flask(__name__)
CORS(app)

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

@app.route('/reset', methods=['POST'])
def reset():
    global type_point_array, subject_id  # ใช้ตัวแปร global
    
    if subject_id:
        folder_path = f'./{subject_id}'  # โฟลเดอร์ที่ต้องลบ
        try:
            # ลบโฟลเดอร์และไฟล์ทั้งหมดในโฟลเดอร์
            if os.path.exists(folder_path):
                shutil.rmtree(folder_path)  # ใช้ shutil.rmtree เพื่อให้ลบโฟลเดอร์ทั้งโฟลเดอร์
                print(f"ลบโฟลเดอร์ {folder_path} สำเร็จ")

            # เชื่อมต่อฐานข้อมูล
            conn = get_db_connection()
            if conn is None:
                return jsonify({"status": "error", "message": "Database connection failed"}), 500
            cursor = conn.cursor()

            # ลบข้อมูลในตาราง label ก่อน
            cursor.execute(
                """
                DELETE FROM label WHERE Subject_id = %s
                """, 
                (subject_id,)
            )

            # ลบข้อมูลในตาราง Group_Point ที่ไม่ได้ถูกใช้งานในตาราง label
            cursor.execute(
                """
                DELETE FROM Group_Point 
                WHERE Group_No NOT IN (
                    SELECT DISTINCT Group_No FROM label WHERE Group_No IS NOT NULL
                )
                """
            )

            # ลบข้อมูลในตาราง Page ที่เชื่อมโยงกับ subject_id
            cursor.execute(
                """
                DELETE FROM Page WHERE Subject_id = %s
                """, 
                (subject_id,)
            )

            conn.commit()  # บันทึกการลบข้อมูลในฐานข้อมูล
            print(f"ลบข้อมูลในฐานข้อมูลสำเร็จสำหรับ Subject_id: {subject_id}")

        except Exception as e:
            conn.rollback()  # ยกเลิกการลบหากเกิดข้อผิดพลาด
            print(f"Error: {str(e)}")
            return jsonify({"status": "error", "message": "Failed to reset data"}), 500
        finally:
            cursor.close()
            conn.close()

    # รีเซ็ตค่า subject_id และ type_point_array
    subject_id = 0
    type_point_array = []
    sheet.reset()

    return jsonify({"status": "reset done", "message": f"Reset complete for subject_id {subject_id}"}), 200


#----------------------- View Page ----------------------------
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



#----------------------- Subject ----------------------------

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
    subject_id = data.get("Subject_id")
    new_subject_name = data.get("Subject_name")

    if not subject_id or not new_subject_name:
        return jsonify({"message": "Subject ID and new Subject Name are required"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"message": "Failed to connect to the database"}), 500

    cursor = conn.cursor()
    cursor.execute(
        'UPDATE Subject SET Subject_name = %s WHERE Subject_id = %s',
        (new_subject_name, subject_id)
    )
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Subject updated successfully"}), 200

@app.route('/delete_subject/<string:subject_id>', methods=['DELETE'])
def delete_subject(subject_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM Subject WHERE Subject_id = %s', (subject_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": "Subject deleted successfully"}), 200


#----------------------- Predict ----------------------------
UPLOAD_FOLDER = "./uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/uploadExamsheet", methods=["POST"])
def upload_examsheet():
    try:
        # ตรวจสอบว่ามีไฟล์ที่อัปโหลดมาหรือไม่
        if "file" not in request.files:
            return jsonify({"success": False, "message": "No file part"})
        
        file = request.files["file"]  # รับไฟล์จาก FormData
        if file.filename == "":
            return jsonify({"success": False, "message": "No file selected"})

        # ตรวจสอบว่าเป็นไฟล์ PDF หรือไม่
        if not file.filename.endswith(".pdf"):
            return jsonify({"success": False, "message": "Invalid file format"})

        # บันทึกไฟล์ PDF ไว้ที่โฟลเดอร์ uploads
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(file_path)

        predict_script = os.path.abspath("./predict.py")  
        subprocess.run(["python3", predict_script, file_path], check=True)

        return jsonify({"success": True, "message": "File uploaded and processed", "filename": file.filename})
    
    except Exception as e:
        print("Error:", str(e))
        return jsonify({"success": False, "message": str(e)})
    

@app.route('/get_pages/<subject_id>', methods=['GET'])
def get_pages(subject_id):
    try:
        # เชื่อมต่อฐานข้อมูล
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # ดึงข้อมูล Page_no จากตาราง Page ตาม Subject_id
        cursor.execute("""
            SELECT Page_no 
            FROM Page 
            WHERE Subject_id = %s
        """, (subject_id,))
        rows = cursor.fetchall()

        # ตรวจสอบว่ามีข้อมูลหรือไม่
        if not rows:
            return jsonify({"status": "error", "message": "No pages found for the given subject"}), 404

        # ส่งข้อมูล Page_no กลับในรูปแบบ JSON
        page_numbers = [row['Page_no'] for row in rows]
        return jsonify({"status": "success", "pages": page_numbers})
    except Exception as e:
        print(f"Error fetching page numbers: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

#----------------------- Student ----------------------------
# ADD Student
UPLOAD_FOLDER = './uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/csv_upload', methods=['POST'])
def csv_upload():
    try:
        subject_id = request.form.get('subjectId')
        section = request.form.get('section')
        uploaded_file = request.files.get('file')

        if not subject_id or not section or not uploaded_file:
            return jsonify({'error': 'Missing data'}), 400

        if not uploaded_file.filename.endswith('.csv'):
            return jsonify({'error': 'Invalid file type. Please upload a CSV file'}), 400

        file_path = os.path.join(app.config['UPLOAD_FOLDER'], uploaded_file.filename)
        uploaded_file.save(file_path)

        process_csv(file_path, subject_id, section)

        return jsonify({'message': 'CSV processed and data added successfully'}), 200

    except Exception as e:
        print(f"Error in csv_upload: {str(e)}")
        return jsonify({'error': str(e)}), 500

def process_csv(file_path, subject_id, section):
    conn = get_db_connection()
    if conn is None:
        raise Exception("Failed to connect to the database")
    
    cursor = conn.cursor()

    try:
        with open(file_path, 'r', encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile)
            header = next(reader)  # ข้าม header ของ CSV

            for row in reader:
                student_id, full_name = row[0].strip(), row[1].strip()  # ลบช่องว่างก่อน/หลังข้อมูล

                # ตรวจสอบว่ามี Student_id อยู่แล้วหรือไม่
                cursor.execute("SELECT COUNT(*) FROM Student WHERE Student_id = %s", (student_id,))
                if cursor.fetchone()[0] == 0:
                    # เพิ่ม Student ใหม่ถ้ายังไม่มี
                    cursor.execute(
                        "INSERT INTO Student (Student_id, Full_name) VALUES (%s, %s)",
                        (student_id, full_name)
                    )
                    print(f"Inserted into Student: {student_id}, {full_name}")

                # เพิ่มข้อมูลใน Enroll
                print(f"Inserting into Enrollment: {student_id}, {subject_id}, {section}")
                cursor.execute(
                    """
                    INSERT INTO Enrollment (Student_id, Subject_id, section)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE section = VALUES(section)
                    """,
                    (student_id, subject_id, section)
                )

        # Commit การเปลี่ยนแปลงในฐานข้อมูล
        conn.commit()
        print("All rows processed and committed successfully.")

    except Exception as e:
        # Rollback หากเกิดข้อผิดพลาด
        conn.rollback()
        print(f"Error processing CSV: {str(e)}")
        raise e

    finally:
        # ปิดการเชื่อมต่อ
        cursor.close()
        conn.close()


# GET STUDENTS
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
 

# EDIT STUDENT
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

# DELETE STUDENT
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
        for row in rows:
            row['Point_single'] = float(row['Point_single']) if row['Point_single'] is not None else None
            row['Point_Group'] = float(row['Point_Group']) if row['Point_Group'] is not None else None

        # print("Fetched Data:", rows) 
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
    point_single = data.get('Point_single')

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        formatted_point = "{:.2f}".format(float(point_single))
        # อัปเดตข้อมูลในฐานข้อมูล
        cursor.execute(
            """
            UPDATE Label 
            SET Answer = %s, Point_single = %s 
            WHERE Label_id = %s
            """,
            (answer, point_single, label_id)
        )
        conn.commit()

        return jsonify({"status": "success", "message": "Label updated successfully"})
    except Exception as e:
        print(f"Error updating label: {e}")
        return jsonify({"status": "error", "message": "Failed to update label"}), 500
    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    app.run(debug=True)
