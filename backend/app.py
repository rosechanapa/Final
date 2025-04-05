import eventlet
eventlet.monkey_patch()

import os
import sys
import webbrowser

# import gevent

# from gevent import monkey
# monkey.patch_all()  # ใช้ gevent monkey patching


# ตรวจสอบ OS และกำหนด Eventlet Hub ที่ถูกต้อง
# if sys.platform == "win32":  # Windows
#     os.environ["EVENTLET_HUB"] = "selects"
# elif sys.platform == "darwin":  # macOS
#     os.environ["EVENTLET_HUB"] = "kqueue"
# elif sys.platform.startswith("linux"):  # Linux
#     os.environ["EVENTLET_HUB"] = "epolls"

import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from db import get_db_connection
import shutil
from werkzeug.utils import secure_filename
from flask_socketio import SocketIO
import stop_flag
from predict import check

from route.subject import subject_bp
from route.analyze import analyze_bp
from route.student import student_bp
from route.createSheet import createSheet_bp
from route.viewExamsheet import viewExamsheet_bp
from route.uploadSheet import uploadSheet_bp
from route.label import label_bp
from route.viewRecheck import viewRecheck_bp
from route.recheck import recheck_bp

app = Flask(__name__)
app.register_blueprint(subject_bp)
app.register_blueprint(analyze_bp)
app.register_blueprint(student_bp)
app.register_blueprint(createSheet_bp)
app.register_blueprint(viewExamsheet_bp)
app.register_blueprint(uploadSheet_bp)
app.register_blueprint(label_bp)
app.register_blueprint(viewRecheck_bp)
app.register_blueprint(recheck_bp)

CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# หรือกำหนดใน SocketIO ด้วย
# socketio = SocketIO(app, cors_allowed_origins="*")
# print("Selected async_mode:", socketio.async_mode) 


# -------------------- DELETE ALL --------------------
@app.route('/delete_all', methods=['DELETE'])
def delete_all():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()

        # เริ่ม Transaction
        cursor.execute("BEGIN TRANSACTION")

        # ==================================================================================
        # ลบโฟลเดอร์ต่างๆ (หากมี)
        # ==================================================================================
        cursor.execute("SELECT Subject_id FROM Subject")
        subjects = cursor.fetchall()

        for subject in subjects:
            folder_path = f'./{subject["Subject_id"]}'
            if os.path.exists(folder_path):
                shutil.rmtree(folder_path)
                print(f"Folder {folder_path} deleted successfully.")
        
        imgcheck_path = './imgcheck'
        if os.path.exists(imgcheck_path):
            shutil.rmtree(imgcheck_path)
            print("Folder ./imgcheck deleted successfully.")
        
        # ==================================================================================
        # ลบข้อมูลในตารางทั้งหมด
        # ==================================================================================
        cursor.execute("DELETE FROM Answer")
        cursor.execute("DELETE FROM Exam_sheet")
        cursor.execute("DELETE FROM Page")
        cursor.execute("DELETE FROM Label")
        cursor.execute("DELETE FROM Group_Point")
        cursor.execute("DELETE FROM Enrollment")
        cursor.execute("DELETE FROM Student")
        cursor.execute("DELETE FROM Subject")

        # Commit การลบทั้งหมด
        conn.commit()

        return jsonify({"status": "success", "message": "All data and folders deleted successfully."})

    except sqlite3.Error as e:
        conn.rollback()  # ย้อนกลับการเปลี่ยนแปลงถ้ามี error
        return jsonify({"status": "error", "message": str(e)}), 500

    finally:
        cursor.close()
        conn.close()

@app.route('/stop_process', methods=['POST'])
def stop_process():
    stop_flag.stop_flag = True
    try:
        socketio.emit('process_stopped', {'message': 'Process stopped successfully'})
    except Exception as e:
        print(f"Error emitting socket event: {e}")
    return jsonify({"success": True, "message": "ได้รับคำสั่งหยุดการทำงานแล้ว!"})


@app.route('/start_predict', methods=['POST'])
def start_predict():
    stop_flag.stop_flag = False  
    
    data = request.get_json()
    subject_id = data.get("subject_id")
    page_no = data.get("page_no")

    if not subject_id or not page_no:
        return jsonify({"success": False, "message": "ข้อมูลไม่ครบถ้วน"}), 400

    # โดยเราจะต้องส่ง socketio เข้าไปด้วย เพื่อที่ใน cal_score จะ emit กลับมาได้
    #check(subject_id, page_no, socketio)

    # สั่งให้รันงาน predict/check ใน background
    socketio.start_background_task(
        target=check,  # ชื่อฟังก์ชันที่จะรัน
        new_subject=subject_id, 
        new_page=page_no, 
        socketio=socketio
    )
    # ตอบกลับไปเลย ไม่ต้องรอ loop เสร็จ
    return jsonify({"success": True, "message": "เริ่มประมวลผลแล้ว!"}), 200

      
if __name__ == '__main__':
    # app.run(debug=True)
    socketio.run(app, host="127.0.0.1", port=5000, debug=True, use_reloader=False)
