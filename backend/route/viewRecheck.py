import os
import sqlite3
from flask import Blueprint,  jsonify, send_file, request
from db import get_db_connection
from fpdf import FPDF
import glob

viewRecheck_bp = Blueprint('viewRecheck', __name__)
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


@viewRecheck_bp.route('/get_listpaper', methods=['POST'])
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


@viewRecheck_bp.route('/show_imgcheck', methods=['GET'])
def show_imgcheck():
    subject_id = request.args.get('subjectId')
    page_no = request.args.get('pageNo')
    sheet_id = request.args.get('sheetId')

    # ตรวจสอบว่ามีพารามิเตอร์ครบหรือไม่
    if not subject_id or not page_no or not sheet_id:
        return jsonify({"error": "Missing subjectId, pageNo, or sheetId"}), 400

    # สร้าง path สำหรับไฟล์รูปภาพ
    image_path = os.path.join(basedir, 'imgcheck', subject_id, page_no, f"{sheet_id}.jpg")

    # ตรวจสอบว่าไฟล์มีอยู่จริงหรือไม่
    if not os.path.exists(image_path):
        return jsonify({"error": "Image not found"}), 404

    try:
        # ส่งไฟล์รูปภาพกลับไป
        return send_file(image_path, mimetype='image/jpeg')
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    
@viewRecheck_bp.route('/download_paper/<subject_id>/<pageno>/<sheet_id>', methods=['GET'])
def download_paper(subject_id, pageno, sheet_id):
    file_path = os.path.join(basedir, 'imgcheck', subject_id, pageno, f"{sheet_id}.jpg")
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    else:
        return jsonify({"status": "error", "message": "Image not found"}), 404
    
    
@viewRecheck_bp.route('/download_paperpdf/<subject_id>/<pageno>', methods=['GET'])
def download_paperpdf(subject_id, pageno):
    folder_path = os.path.join(basedir, 'imgcheck', subject_id, pageno)
    images = sorted(glob.glob(os.path.join(folder_path, "*.jpg")))
    
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