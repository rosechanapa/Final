import os
import sqlite3
from flask import Blueprint,  jsonify, request
from db import get_db_connection
from io import BytesIO
from predict import convert_pdf, convert_allpage
import shutil

uploadSheet_bp = Blueprint('uploadSheet', __name__)

basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

#----------------------- UP PDF Predict ----------------------------
@uploadSheet_bp.route('/get_pages/<subject_id>', methods=['GET'])
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


@uploadSheet_bp.route('/uploadExamsheet', methods=['POST'])
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
        folder_path = os.path.join(basedir, subject_id, 'predict_img')
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
 
@uploadSheet_bp.route('/delete_file', methods=['DELETE'])
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
            file_path = os.path.join(basedir, subject_id, 'predict_img', page_no, f"{sheet_id}.jpg")
            try:
                os.remove(file_path)
                deleted_files.append(file_path)
            except FileNotFoundError:
                failed_files.append(file_path)

        # ลบโฟลเดอร์หลังจากลบไฟล์ทั้งหมด
        folder_path = os.path.join(basedir, subject_id, 'predict_img', page_no)
        if os.path.exists(folder_path) and os.path.isdir(folder_path):
            try:
                shutil.rmtree(folder_path)
            except Exception as e:
                print(f"ไม่สามารถลบโฟลเดอร์ {folder_path} ได้: {str(e)}")

        check_path = os.path.join(basedir, 'imgcheck', subject_id, page_no)
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

@uploadSheet_bp.route('/get_sheets', methods=['GET'])
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
 
@uploadSheet_bp.route('/find_paper', methods=['POST'])
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


@uploadSheet_bp.route('/delete_paper', methods=['POST'])
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
        image_path = os.path.join(basedir, subject_id, 'predict_img', page_no, f"{sheet_id}.jpg")

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


@uploadSheet_bp.route('/check_data', methods=['POST'])
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

