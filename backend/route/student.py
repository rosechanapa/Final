import sqlite3
from flask import Blueprint, request, jsonify
from db import get_db_connection
import csv
import chardet
import pandas as pd

student_bp = Blueprint('student', __name__)

#----------------------- Student ----------------------------

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


@student_bp .route('/csv_upload', methods=['POST'])
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
@student_bp .route('/get_students', methods=['GET'])
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
 
@student_bp .route('/get_sections', methods=['GET'])
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
@student_bp .route('/delete_student/<string:student_id>', methods=['DELETE'])
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

@student_bp .route('/delete_students', methods=['POST'])
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
@student_bp .route('/edit_student', methods=['PUT'])
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