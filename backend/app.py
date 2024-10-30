from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import paper
import sheet
from sheet import update_array
from sheet import update_variable
from sheet import get_images_as_base64

app = Flask(__name__)
CORS(app)

@app.route('/create_sheet', methods=['POST'])
def create_sheet():
    data = request.json
    subject_id = data.get('subject_id')
    part = data.get('part')

    update_variable(subject_id, part)
    return jsonify({"status": "success", "message": "Sheet created"})

@app.route('/submit_parts', methods=['POST'])
def submit_parts():
    data = request.json
    case_array = data.get('case_array')
    range_input_array = data.get('range_input_array')
    type_point_array = data.get('type_point_array')
    option_array = data.get('option_array')

    update_array(case_array, range_input_array, type_point_array, option_array)
    return jsonify({"status": "success", "message": "Parts data submitted"})


@app.route('/get_images', methods=['GET'])
def get_images():
    # เรียกใช้ฟังก์ชัน get_images_as_base64 เพื่อแปลงภาพทั้งหมดเป็น Base64
    base64_images = get_images_as_base64()
    return jsonify({"status": "success", "images": base64_images})


@app.route('/reset', methods=['POST'])
def reset():
    sheet.reset()
    return jsonify({"status": "reset done"}), 200



 

if __name__ == '__main__':
    app.run(debug=True)
