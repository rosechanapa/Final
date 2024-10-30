from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import paper
import sheet
from sheet import update_array
from sheet import update_variable

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

@app.route('/start', methods=['POST'])
def reset():
    sheet.reset()
    return jsonify({"status": "reset done"}), 200




@app.route('/create_paper', methods=['POST'])
def create_paper_endpoint():
    data = request.get_json()
    subject_id = data.get('subject_id')
    page_number = data.get('page_number')
    paper.start_number = data.get('start_number')  # อัปเดต start_number ใน paper module

    first_image_data = paper.create_paper(subject_id, page_number)

    img_str = base64.b64encode(first_image_data).decode('utf-8')
    
    return jsonify({"image": img_str}), 200

@app.route('/generate', methods=['POST'])
def generate_paper():
    data = request.get_json()
    selected_case = data.get('selected_case')
    range_input = int(data.get('range_input'))
    type_input = data.get('type_input')

    img_str, status = paper.generate_paper(selected_case, range_input, type_input)

    return jsonify({"image": img_str, "status": status}), 200

@app.route('/reset', methods=['POST'])
def reset_positions():
    paper.reset_positions()
    return jsonify({"status": "reset done"}), 200

if __name__ == '__main__':
    app.run(debug=True)
