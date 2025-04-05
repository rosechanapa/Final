import sqlite3
from flask import Blueprint, request, jsonify
from db import get_db_connection


analyze_bp = Blueprint('analyze', __name__)


# -------------------- COUNT STUDENT --------------------

@analyze_bp.route('/get_student_count', methods=['GET'])
def get_student_count():
    subject_id = request.args.get('subject_id') 
    section = request.args.get('section')      

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้เข้าถึงข้อมูลผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # Query นับจำนวน Student_id โดยไม่กรอง Section หาก section ว่าง
        query = """
            SELECT COUNT(DISTINCT e.Student_id) AS student_count
            FROM Enrollment e
            WHERE e.Subject_id = ?
        """
        params = [subject_id]

        if section:  # กรองเฉพาะ Section ถ้าไม่ว่าง
            query += " AND e.Section = ?"
            params.append(section)

        cursor.execute(query, params)
        result = cursor.fetchone()
        student_count = result["student_count"] if result else 0

        return jsonify({"success": True, "student_count": student_count})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@analyze_bp.route('/update_totals', methods=['POST'])
def update_totals():
    subject_id = request.json.get('subject_id')
    section = request.json.get('section')

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ใช้ row_factory เพื่อเข้าถึงคอลัมน์ผ่านชื่อ
        cursor = conn.cursor()

        # อัปเดตค่า Total ในตาราง Enrollment
        query = """
            SELECT es.Id_predict AS Student_id, SUM(es.Score) AS total_score
            FROM Exam_sheet es
            JOIN Page p ON es.Page_id = p.Page_id
            WHERE p.Subject_id = ? 
            GROUP BY es.Id_predict
        """
        cursor.execute(query, (subject_id,))
        total_scores = cursor.fetchall()

        # อัปเดตค่า Total ในตาราง Enrollment
        for row in total_scores:
            student_id = row["Student_id"]
            total_score = row["total_score"]

            update_query = """
                UPDATE Enrollment 
                SET Total = ?
                WHERE Student_id = ? AND Subject_id = ? AND Section = ?
            """
            cursor.execute(update_query, (total_score, student_id, subject_id, section))

        conn.commit()

        return jsonify({"success": True, "message": "Totals updated successfully."})

    except Exception as e:
        conn.rollback()  # ยกเลิกการเปลี่ยนแปลงหากเกิดข้อผิดพลาด
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        cursor.close()
        conn.close()
# -------------------- Score --------------------

@analyze_bp.route('/get_scores_summary', methods=['GET'])
def get_scores_summary():
    subject_id = request.args.get('subject_id')
    section = request.args.get('section')

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์
        cursor = conn.cursor()

        # Query หาคะแนนสูงสุด, ต่ำสุด, และค่าเฉลี่ย
        query = """
            SELECT 
                MAX(e.Total) AS max_score,
                MIN(e.Total) AS min_score,
                AVG(e.Total) AS avg_score
            FROM Enrollment e
            WHERE e.Subject_id = ?
        """
        params = [subject_id]

        if section:  # หากมี Section ให้กรอง
            query += " AND e.Section = ?"
            params.append(section)

        cursor.execute(query, params)
        result = cursor.fetchone()

        # จัดการผลลัพธ์
        scores_summary = {
            "max_score": result["max_score"] if result["max_score"] is not None else 0,
            "min_score": result["min_score"] if result["min_score"] is not None else 0,
            "avg_score": round(result["avg_score"], 2) if result["avg_score"] is not None else 0,
        }

        return jsonify({"success": True, "scores_summary": scores_summary})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@analyze_bp.route('/get_total_score', methods=['GET'])
def get_total_score():
    subject_id = request.args.get('subject_id')

    if not subject_id:
        return jsonify({"success": False, "message": "Missing subject_id"}), 400

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้ผลลัพธ์สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # คำนวณคะแนนเต็มจาก Point_single และ Point_group
        query = """
            SELECT 
                 COALESCE(SUM(l.Point_single), 0) AS total_single,
                 (
                    SELECT COALESCE(SUM(gp.Point_group), 0)
                    FROM Group_point gp
                    WHERE gp.Group_no IN (
                       SELECT DISTINCT l.Group_no
                       FROM Label l
                       WHERE l.Subject_id = ?
                       AND l.Group_no IS NOT NULL
                    )
                ) AS total_group
            FROM Label l
            WHERE l.Subject_id = ?
        """
        cursor.execute(query, (subject_id, subject_id))
        result = cursor.fetchone()

        total_score = result["total_single"] + (result["total_group"] or 0)

        return jsonify({
            "success": True,
            "total_score": total_score
        })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        cursor.close()
        conn.close()


@analyze_bp.route('/get_summary', methods=['GET'])
def get_summary():
    subject_id = request.args.get('subject_id')

    if not subject_id:
        return jsonify({"error": "Missing subject_id"}), 400

    try:
        # Connect to the database
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row  # ทำให้สามารถเข้าถึงค่าผ่านชื่อคอลัมน์ได้
        cursor = conn.cursor()

        # ดึง Label_id, No, และ Type ของข้อสอบในวิชานั้น
        cursor.execute("SELECT Label_id, No, Type FROM Label WHERE Subject_id = ?", (subject_id,))
        label_data = cursor.fetchall()

        # กรอง Label_id ที่ไม่ใช่ Type '3', '6', และ 'free'
        total_dict = {}
        valid_label_ids = []
        for label in label_data:
            if label["Type"] not in ("3", "6", "free"):
                total_dict[label["Label_id"]] = {"no": label["No"], "max_total": 0}
                valid_label_ids.append(label["Label_id"])

        if not valid_label_ids:
            return jsonify({"error": "No valid labels found"}), 400

        # ดึง Modelread จาก Answer ที่ Label_id อยู่ใน valid_label_ids
        format_strings = ",".join("?" * len(valid_label_ids))
        cursor.execute(f"""
            SELECT Answer.Label_id, Answer.Modelread, Label.Answer 
            FROM Answer 
            JOIN Label ON Answer.Label_id = Label.Label_id
            WHERE Answer.Label_id IN ({format_strings})
        """, tuple(valid_label_ids))
        answer_data = cursor.fetchall()

        # ตรวจสอบคำตอบ (ให้คำตอบตัวเล็กหรือตัวใหญ่ก็ได้)
        for ans in answer_data:
            if ans["Modelread"].strip().lower() == ans["Answer"].strip().lower():
                total_dict[ans["Label_id"]]["max_total"] += 1

        # จัดลำดับ key ตามค่ามากสุดและน้อยสุด
        sorted_total = sorted(total_dict.items(), key=lambda x: x[1]["max_total"], reverse=True)
        top_max = [{"no": value["no"], "correct_count": value["max_total"]} for _, value in sorted_total[:5]]
        top_low = [
            {"no": value["no"], "correct_count": value["max_total"]}
            for _, value in sorted_total[-5:]
            if value["no"] not in [item["no"] for item in top_max]
        ]

        return jsonify({"top_max_no": top_max, "top_low_no": top_low})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@analyze_bp.route('/get_score_chart', methods=['GET'])
def get_score_distribution():
    subject_id = request.args.get('subject_id')
    section = request.args.get('section')  # Optional

    if not subject_id:
        return jsonify({"success": False, "message": "Missing subject_id"}), 400

    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        if section:
            query = """
                SELECT Total
                FROM Enrollment
                WHERE Subject_id = ? AND Section = ? AND Total > 0
            """
            cursor.execute(query, (subject_id, section))
        else:
            query = """
                SELECT Total
                FROM Enrollment
                WHERE Subject_id = ? AND Total > 0
            """
            cursor.execute(query, (subject_id,))

        results = cursor.fetchall()
        if not results:
            return jsonify({"success": False, "message": "No scores found."}), 404

        # สร้าง dict นับจำนวนของแต่ละคะแนน
        score_counts = {}
        for row in results:
            score = int(row["Total"])
            score_counts[score] = score_counts.get(score, 0) + 1

        return jsonify({
            "success": True,
            "distribution": score_counts
        })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        cursor.close()
        conn.close()