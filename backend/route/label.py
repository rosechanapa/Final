import sqlite3
from flask import Blueprint,  jsonify
from db import get_db_connection
from flask import  request, jsonify

label_bp = Blueprint('label', __name__)

#---------------------- Label ----------------------------
@label_bp.route('/get_labels/<subject_id>', methods=['GET'])
def get_labels(subject_id):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT 
                l.Label_id, 
                l.No, 
                l.Answer, 
                l.Point_single, 
                l.Group_No, 
                gp.Point_Group,
                l.Type,
                l.Free
            FROM Label l
            LEFT JOIN Group_Point gp ON l.Group_No = gp.Group_No
            WHERE l.Subject_id = ?
            ORDER BY l.No
            """,
            (subject_id,)
        )

        rows = cursor.fetchall()

        # แปลงข้อมูลเป็น dictionary
        labels = [dict(row) for row in rows]

        return jsonify({"status": "success", "data": labels})
    except Exception as e:
        print(f"Error fetching labels: {e}")
        return jsonify({"status": "error", "message": "Failed to fetch labels"}), 500
    finally:
        cursor.close()
        conn.close()


@label_bp.route('/update_label/<label_id>', methods=['PUT'])
def update_label(label_id):
    data = request.json
    answer = data.get('Answer')

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # อัปเดตข้อมูลในตาราง Label
        cursor.execute(
            """
            UPDATE Label
            SET Answer = ?
            WHERE Label_id = ?
            """,
            (answer, label_id)
        )
        conn.commit()

        return jsonify({"status": "success", "message": "Answer updated successfully"})
    except Exception as e:
        print(f"Error updating answer: {e}")
        return jsonify({"status": "error", "message": "Failed to update answer"}), 500
    finally:
        cursor.close()
        conn.close()

@label_bp.route('/update_point/<label_id>', methods=['PUT'])
def update_point(label_id):
    data = request.json
    point = data.get('point', None)

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # ตรวจสอบ Group_No จาก label_id
        cursor.execute("SELECT Group_No FROM Label WHERE Label_id = ?", (label_id,))
        result = cursor.fetchone()

        if result is None:
            return jsonify({"status": "error", "message": "Label_id not found"}), 404

        group_no = result["Group_No"]

        if group_no is None:
            # กรณี Group_No เป็น null
            cursor.execute(
                """
                UPDATE Label
                SET Point_single = ?
                WHERE Label_id = ?
                """,
                (point, label_id)
            )
        else:
            # กรณี Group_No ไม่เป็น null
            cursor.execute(
                """
                UPDATE Group_Point
                SET Point_Group = ?
                WHERE Group_No = ?
                """,
                (point, group_no)
            )

        conn.commit()
        return jsonify({"status": "success", "message": "Point updated successfully"})

    except Exception as e:
        print(f"Error updating point: {e}")
        return jsonify({"status": "error", "message": "Failed to update point"}), 500
    finally:
        cursor.close()
        conn.close()

@label_bp.route('/update_free/<label_id>', methods=['PUT'])
def update_free(label_id):
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # ตรวจสอบว่า Label_id มี Group_No หรือไม่
        cursor.execute(
            """
            SELECT Group_No
            FROM Label
            WHERE Label_id = ?
            """,
            (label_id,)
        )
        result = cursor.fetchone()

        if result and result["Group_No"]:  # ใช้ชื่อคอลัมน์แทน index
            # หาก Group_No ไม่เป็น NULL
            group_no = result["Group_No"]

            # อัปเดต Label ที่มี Group_No เดียวกัน
            cursor.execute(
                """
                UPDATE Label
                SET Free = 1
                WHERE Group_No = ?
                """,
                (group_no,)
            )
        else:
            # หาก Group_No เป็น NULL
            cursor.execute(
                """
                UPDATE Label
                SET Free = 1
                WHERE Label_id = ?
                """,
                (label_id,)
            )

        conn.commit()

        return jsonify({"status": "success", "message": "Free status updated successfully"})
    except Exception as e:
        print(f"Error updating Free column: {e}")
        return jsonify({"status": "error", "message": "Failed to update Free status"}), 500
    finally:
        cursor.close()
        conn.close()


@label_bp.route('/cancel_free', methods=['POST'])
def cancel_free():
    data = request.json

    label_id = data.get('label_id')

    if not label_id:
        return jsonify({"status": "error", "message": "Invalid input"}), 400

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # ตรวจสอบ Group_No ของ Label_id ที่ระบุ
        cursor.execute(
            """
            SELECT Group_No
            FROM Label
            WHERE Label_id = ?
            """,
            (label_id,)
        )
        result = cursor.fetchone()

        if result and result["Group_No"]:
            group_no = result["Group_No"]

            # อัปเดต Free = 0 สำหรับทั้งกลุ่ม
            cursor.execute(
                """
                UPDATE Label
                SET Free = 0
                WHERE Group_No = ?
                """,
                (group_no,)
            )
        else:
            # อัปเดต Free = 0 เฉพาะ Label เดียว
            cursor.execute(
                """
                UPDATE Label
                SET Free = 0
                WHERE Label_id = ?
                """,
                (label_id,)
            )

        conn.commit()

        return jsonify({"status": "success", "message": "Free status updated successfully"})
    except Exception as e:
        print(f"Error updating Free column: {e}")
        return jsonify({"status": "error", "message": "Failed to update Free status"}), 500
    finally:
        cursor.close()
        conn.close()

@label_bp.route('/update_Check', methods=['POST'])
def update_Check():
    data = request.json
    subject_id = data.get('Subject_id')

    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # 1) หา Page_id ที่ตรงกับ Subject_id
        cursor.execute('''
            SELECT Page_id
            FROM Page
            WHERE Subject_id = ?
        ''', (subject_id,))
        temp_page = [row["Page_id"] for row in cursor.fetchall()]

        # 2) หา Sheet_id จาก Page_id
        sheet = []
        for page_id in temp_page:
            cursor.execute('''
                SELECT Sheet_id
                FROM Exam_sheet
                WHERE Page_id = ?
            ''', (page_id,))
            sheet += [row["Sheet_id"] for row in cursor.fetchall()]

        # 3) คำนวณคะแนนในแต่ละ Sheet
        for sheet_id in sheet:
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
            group_answers = {}  # { group_no: [(ans_id, modelread_str, answer_str, point_group, type, point_single), ...] }
            checked_groups = set()

            for row in answers:
                ans_id       = row["Ans_id"]
                ans_type     = row["Type"]
                modelread_str = str(row["Modelread"]) if row["Modelread"] else ""
                answer_str   = str(row["Answer"]) if row["Answer"] else ""
                group_no     = row["Group_No"]
                point_group  = row["Point_Group"]
                point_single = row["Point_single"]
                score_point  = row["Score_point"]
                free         = row["Free"]

                # -------------------- (1) Type = 'free' --------------------
                if free == 1:  
                    if point_single is not None:
                        sum_score += point_single
                    elif group_no is not None and group_no not in checked_groups:
                        if point_group is not None:
                            sum_score += point_group
                            checked_groups.add(group_no)
                    continue

                # -------------------- (2) Type = '6' --------------------
                if ans_type == '6' and score_point is not None:
                    sum_score += score_point
                    continue

                # -------------------- (3) กรณีอื่น ๆ (รวมถึง type = '3') --------------------
                if group_no is not None:
                    # เก็บไว้ตรวจหลัง loop
                    if group_no not in group_answers:
                        group_answers[group_no] = []
                    group_answers[group_no].append((
                        ans_id, modelread_str, answer_str, point_group, ans_type, point_single
                    ))
                else:
                    # กรณีไม่อยู่ในกลุ่ม -> ตรวจเป็นแถว
                    if ans_type == '3' and answer_str:
                        # ถ้าต้องการตรวจว่ามี '.' => ใช้ startswith
                        if '.' in answer_str:
                            # ถ้า modelread_str ขึ้นต้นด้วย answer_str
                            if modelread_str.startswith(answer_str):
                                # อัปเดต Modelread ให้เป็น Answer
                                cursor.execute('UPDATE Answer SET Modelread=? WHERE Ans_id=?', (answer_str, ans_id))
                                # ให้คะแนนตาม point_single
                                if point_single is not None:
                                    sum_score += point_single
                                    # อัปเดต Score_point ในตาราง Answer ให้เท่ากับ point_single
                                    update_answer_query = '''
                                        UPDATE Answer
                                        SET Score_point = ?
                                        WHERE Ans_id = ?
                                    '''
                                    cursor.execute(update_answer_query, (point_single, ans_id))
                            else:
                                # กรณีไม่ตรง prefix
                                if score_point is not None:
                                    sum_score += score_point
                        else:
                            # ถ้าไม่มี '.' => ต้อง == เป๊ะ
                            if modelread_str == answer_str:
                                if point_single is not None:
                                    sum_score += point_single
                                    # อัปเดต Score_point
                                    update_answer_query = '''
                                        UPDATE Answer
                                        SET Score_point = ?
                                        WHERE Ans_id = ?
                                    '''
                                    cursor.execute(update_answer_query, (point_single, ans_id))
                            else:
                                if score_point is not None:
                                    sum_score += score_point

                    else:
                        # กรณีไม่ใช่ type=3 หรือ answer_str ว่าง -> เทียบตรง
                        if modelread_str.lower() == answer_str.lower() and point_single is not None:
                            sum_score += point_single

            # -------------------- (4) ตรวจสอบคะแนนในกลุ่ม --------------------
            for g_no, ans_list in group_answers.items():
                if g_no not in checked_groups:
                    # ans_list => [ (ans_id, m_str, a_str, p_group, ans_type, p_single), ... ]
                    all_correct = True

                    for (aid, m_str, a_str, p_group, a_type, p_single) in ans_list:
                        if a_type == '3' and a_str:
                            if '.' in a_str:
                                if not m_str.startswith(a_str):
                                    all_correct = False
                                    break
                                else:
                                    # อัปเดต modelread
                                    cursor.execute('UPDATE Answer SET Modelread=? WHERE Ans_id=?', (a_str, aid))
                            else:
                                # ไม่มี '.' => ต้อง == เป๊ะ
                                if m_str != a_str:
                                    all_correct = False
                                    break
                        else:
                            # type อื่น => ใช้เทียบตรงพิมพ์เล็ก
                            if m_str.lower() != a_str.lower():
                                all_correct = False
                                break

                    if all_correct:
                        # ถ้าในกลุ่มนี้ถูกทุกแถว => บวก Point_Group
                        p_group = ans_list[0][3]  # ตัวแรกในกลุ่ม (point_group)
                        if p_group is not None:
                            sum_score += p_group

                            # เพิ่มเติม: อัปเดต Score_point ให้แถวแรกในกลุ่มด้วย
                            # สมมติเราเลือกแถวแรกเป็นตัวแทน
                            first_ans_id = ans_list[0][0]  # ans_id ของตัวแรก
                            cursor.execute('''
                                UPDATE Answer
                                SET Score_point = ?
                                WHERE Ans_id = ?
                            ''', (p_group, first_ans_id))
                    else:
                        # กรณีไม่ถูกทั้งหมด 
                        # สมมติอยากอัปเดต Score_point ของแถวแรก (หรือทุกแถว) ในกลุ่มให้เป็น 0
                        first_ans_id = ans_list[0][0]
                        cursor.execute('''
                            UPDATE Answer
                            SET Score_point = 0
                            WHERE Ans_id = ?
                        ''', (first_ans_id,))

                    checked_groups.add(g_no)

            # อัปเดตคะแนนรวมในตาราง Exam_sheet
            cursor.execute('''
                UPDATE Exam_sheet
                SET Score = ?
                WHERE Sheet_id = ?
            ''', (sum_score, sheet_id))
            conn.commit()

        # 5) อัปเดตคะแนนรวมในตาราง Enrollment
        cursor.execute('''
            UPDATE Enrollment
            SET Total = (
                SELECT SUM(es.Score)
                FROM Exam_sheet es
                JOIN Page p ON es.Page_id = p.Page_id
                WHERE es.Id_predict = Enrollment.Student_id
                  AND p.Subject_id = Enrollment.Subject_id
            )
            WHERE Subject_id = ?
        ''', (subject_id,))
        conn.commit()

        return jsonify({"status": "success", "message": "Scores calculated and updated successfully."})

    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)})

    finally:
        cursor.close()
        conn.close()

