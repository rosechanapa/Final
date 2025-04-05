import os
import sqlite3
from db import get_db_connection
from flask import Blueprint, request, jsonify,  send_file,  send_from_directory , abort
import json

recheck_bp = Blueprint('recheck', __name__)
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

#----------------------- Recheck ----------------------------
# Route to find all sheet IDs for the selected subject and page
@recheck_bp.route('/find_sheet', methods=['POST'])
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

@recheck_bp.route('/cleanup_duplicate_answers/<int:sheet_id>', methods=['POST'])
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
@recheck_bp.route('/find_sheet_by_id/<int:sheet_id>', methods=['GET'])
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

@recheck_bp.route('/update_modelread/<Ans_id>', methods=['PUT'])
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
        

@recheck_bp.route('/cal_scorepage', methods=['POST'])
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



@recheck_bp.route('/update_scorepoint/<Ans_id>', methods=['PUT'])
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



@recheck_bp.route('/sheet_image/<int:sheet_id>', methods=['GET'])
def sheet_image(sheet_id):
    subject_id = request.args.get('subject_id')  # รับ subject_id จาก query string
    page_no = request.args.get('page_no')  # รับ page_no จาก query string

    if not subject_id:
        abort(400, description="Subject ID is required")  # ส่ง error 400 ถ้าไม่มี subject_id
    if not page_no:
        abort(400, description="Page number is required")  # ส่ง error 400 ถ้าไม่มี page_no

    # Path ของไฟล์ภาพ .jpg
    image_path = os.path.join(basedir, subject_id, 'predict_img', page_no, f"{sheet_id}.jpg")

    # ตรวจสอบว่าไฟล์มีอยู่หรือไม่
    if not os.path.exists(image_path):
        abort(404, description="Image not found")  # ส่ง error 404 ถ้าไม่มีไฟล์ภาพ

    # ส่งไฟล์ภาพกลับไปที่ Front-end
    return send_file(image_path, mimetype='image/jpeg')


@recheck_bp.route('/edit_predictID', methods=['POST'])
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

@recheck_bp.route('/get_position', methods=['GET'])
def get_position():
    subject_id = request.args.get('subjectId')
    page_no = request.args.get('pageNo')
    if not subject_id or not page_no:
        return jsonify({"error": "subjectId or pageNo is missing"}), 400

    # Path สำหรับไฟล์ positions
    file_path = os.path.join(basedir, subject_id, 'positions', f"positions_{page_no}.json")
    try:
        with open(file_path, 'r') as file:
            positions = json.load(file)
        return jsonify(positions), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@recheck_bp.route('/images/<string:subject_id>/<string:page_no>/<string:sheet_id>', methods=['GET'])
def serve_image(subject_id, page_no, sheet_id):
    image_folder = os.path.join(basedir, subject_id, 'predict_img', page_no)
    filename = f"{sheet_id}.jpg"
    return send_from_directory(image_folder, filename)


@recheck_bp.route('/get_imgcheck', methods=['POST'])
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
        save_path = os.path.join(basedir, 'imgcheck', subject_id, page_no, f"{exam_sheet_id}.jpg")
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

@recheck_bp.route('/cal_enroll', methods=['POST'])
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
