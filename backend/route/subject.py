import os
import shutil
import sqlite3
from flask import Blueprint, request, jsonify
from db import get_db_connection

subject_bp = Blueprint('subject', __name__)

basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
#----------------------- Subject ----------------------------

@subject_bp.route('/add_subject', methods=['POST'])
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

@subject_bp.route('/get_subjects', methods=['GET'])
def get_subjects():
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row 
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
 

@subject_bp.route('/edit_subject', methods=['PUT'])
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
            old_folder_path = os.path.join(basedir, old_subject_id)
            new_folder_path = os.path.join(basedir, new_subject_id)
            
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
 

@subject_bp.route('/delete_subject/<string:subject_id>', methods=['DELETE'])
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
        folder_path = os.path.join(basedir, subject_id)
        if os.path.exists(folder_path):
            shutil.rmtree(folder_path)
            print(f"Folder {folder_path} deleted successfully.")
        else:
            print(f"Folder {folder_path} does not exist. Skipping folder deletion.")

        check_path = os.path.join(basedir, 'imgcheck', subject_id)
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
   