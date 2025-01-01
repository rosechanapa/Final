from flask import Flask, request, jsonify,  send_file
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
import ftfy  
import chardet
from werkzeug.utils import secure_filename


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
    global subject_id, type_point_array

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

        # เพิ่มข้อมูลจาก type_point_array ในตาราง label
        for item in type_point_array:  # วนลูป dict ใน type_point_array
            for no, data in item.items():  # วนลูป key (No) และ value (data) ใน dict
                label_type = data.get('type')
                point = data.get('point')
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
                    # กรณีประเภท Group (เพิ่มข้อมูลเพิ่มเติมหากต้องการ)
                    print(f"Skip Group Type for No={no}")  # สามารถเพิ่มการจัดการกรณี Group ได้ตามความต้องการ

        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Error: {str(e)}")
        return jsonify({"status": "error", "message": "Failed to save images or update database"}), 500
    finally:
        cursor.close()
        conn.close()

    return jsonify({"status": "success", "message": "Images saved successfully"})


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

@app.route('/delete_image/<subject_id>/<image_id>', methods=['DELETE'])
def delete_image(subject_id, image_id):
    file_path = f'./{subject_id}/pictures/{image_id}.jpg'
    if os.path.exists(file_path):
        os.remove(file_path)
        return jsonify({"status": "success", "message": "Image deleted successfully"})
    else:
        return jsonify({"status": "error", "message": "Image not found"}), 404




























@app.route('/reset', methods=['POST'])
def reset():
    global type_point_array, subject_id  # ระบุว่าใช้ตัวแปร global
    subject_id = 0
    type_point_array = []
    
    sheet.reset()
    return jsonify({"status": "reset done"}), 200


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

def convert_csv_to_utf8(input_file, output_file):
    # ตรวจสอบ encoding ของไฟล์ต้นฉบับ
    with open(input_file, 'rb') as f:
        raw_data = f.read()
        result = chardet.detect(raw_data)
        source_encoding = result['encoding']

    # อ่านไฟล์ด้วย encoding ต้นฉบับและแปลงเป็น UTF-8
    with open(input_file, 'r', encoding=source_encoding) as infile:
        content = infile.read()

    with open(output_file, 'w', encoding='utf-8') as outfile:
        outfile.write(content)

    print(f"Converted {input_file} from {source_encoding} to UTF-8.")


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

        file_path = os.path.join(app.config['UPLOAD_FOLDER'], uploaded_file.filename)
        uploaded_file.save(file_path)
        
        utf8_file_path = file_path.replace('.csv', '_utf8.csv')
        convert_csv_to_utf8(file_path, utf8_file_path)

        process_csv(utf8_file_path, subject_id, Section)

        return jsonify({'message': 'CSV processed and data added successfully'}), 200
    
        


    except Exception as e:
        print(f"Error in csv_upload: {str(e)}")
        return jsonify({'error': str(e)}), 500



def process_csv(utf8_file_path, subject_id, Section):
    # ตรวจสอบ encoding ของไฟล์
    with open(utf8_file_path, 'rb') as f:
        raw_data = f.read()
        result = chardet.detect(raw_data)
        file_encoding = result['encoding']
        print(f"Detected file encoding: {file_encoding}")

    conn = get_db_connection()
    if conn is None:
        raise Exception("Failed to connect to the database")

    cursor = conn.cursor()

    try:
        with open(utf8_file_path, 'r', encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile)
            header = next(reader)  # ข้าม header ของ CSV

            for row in reader:
                student_id = row[0].strip()  # แก้ไข encoding ของ student_id
                full_name = row[1].strip()  # แก้ไข encoding ของ full_name

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
                print(f"Inserting into Enrollment: {student_id}, {subject_id}, {Section}")
                cursor.execute(
                    """
                    INSERT INTO Enrollment (Student_id, Subject_id, Section)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE Section = VALUES(Section)
                    """,
                    (student_id, subject_id, Section)
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


if __name__ == '__main__':
    app.run(debug=True)
