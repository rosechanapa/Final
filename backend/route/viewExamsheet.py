import os
import sqlite3
from flask import Blueprint,  jsonify, send_file
from db import get_db_connection
from fpdf import FPDF
import glob

viewExamsheet_bp = Blueprint('viewExamsheet', __name__)
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


#----------------------- View Page ----------------------------
@viewExamsheet_bp.route('/view_subjects', methods=['GET'])
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

@viewExamsheet_bp.route('/view_pages/<subject_id>', methods=['GET'])
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


@viewExamsheet_bp.route('/get_image_subject/<subject_id>/<filename>', methods=['GET'])
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
      
    
@viewExamsheet_bp.route('/download_image/<subject_id>/<image_id>', methods=['GET'])
def download_image(subject_id, image_id):
    file_path = os.path.join(basedir, subject_id, 'pictures', f"{image_id}.jpg")
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    else:
        return jsonify({"status": "error", "message": "Image not found"}), 404
    
    
@viewExamsheet_bp.route('/download_pdf/<subject_id>', methods=['GET'])
def download_pdf(subject_id):
    folder_path = os.path.join(basedir, subject_id, 'pictures')
    images = sorted(glob.glob(os.path.join(folder_path, "*.jpg")))
    
    if not images:
        return jsonify({"status": "error", "message": "No images found"}), 404
    
    pdf = FPDF()
    for img_path in images:
        pdf.add_page()
        pdf.image(img_path, x=10, y=10, w=190)  # ปรับตำแหน่งและขนาดภาพ
    
    pdf_output_path = os.path.join(folder_path, "combined.pdf")
    pdf.output(pdf_output_path)

    return send_file(pdf_output_path, as_attachment=True, download_name=f"{subject_id}.pdf")