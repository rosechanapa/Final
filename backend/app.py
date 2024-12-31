from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
from io import BytesIO
import os
from PIL import Image
import sheet
from sheet import update_array, update_variable, get_images_as_base64
from db import get_db_connection
import subprocess
import csv

app = Flask(__name__)
CORS(app)

#----------------------- Create ----------------------------
subject_id = 0
type_point_array = []

@app.route('/create_sheet', methods=['POST'])
def create_sheet():
    global subject_id

    data = request.json
    new_subject_id = data.get('subject_id')
    part = int(data.get('part'))
    page_number = int(data.get('page_number'))

    subject_id = new_subject_id
    print("Subject ID:", subject_id)

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
    global subject_id

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
    global type_point_array, subject_id  # ระบุว่าใช้ตัวแปร global
    subject_id = 0
    type_point_array = []
    
    sheet.reset()
    return jsonify({"status": "reset done"}), 200

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

#----------------------- Student ----------------------------
# กำหนดเส้นทางสำหรับจัดเก็บไฟล์ที่อัปโหลด
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
                print(f"Inserting into Enroll: {student_id}, {subject_id}, {section}")
                cursor.execute(
                    """
                    INSERT INTO Enroll (Student_id, Subject_id, section)
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



if __name__ == '__main__':
    app.run(debug=True)
