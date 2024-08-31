from flask import Flask, request, jsonify, session
from flask_cors import CORS
from PIL import Image, ImageDraw, ImageFont
import io
import base64
import json
import os

app = Flask(__name__)
CORS(app)

# กำหนดฟอนต์ที่ใช้
font_path = "../font/DejaVuSans.ttf"
font = ImageFont.truetype(font_path, 45)
font_large = ImageFont.truetype(font_path, 60)

# ตัวแปร global เพื่อเก็บสถานะของ base_x, base_y, previous_case
base_x = 310
base_y = 650
previous_case = None
spacing_x = 350
spacing_y = 350

def create_paper(subject_id, page_number):
    width, height = 2480, 3508
    image = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(image)

    if os.path.exists("positions.json"):
        os.remove("positions.json")

    position_data = {
        "page": (1950, 200),
        "studentID": []
    }

    draw.text((210, 200), f"{subject_id}", font=font, fill='black')
    draw.text((480, 200), "Name (in Thai)      __________________________________________", font=font, fill='black')
    draw.text((210, 450), "studentID", font=font, fill='black')
    draw.text((1950, 200), f"page {page_number}", font=font, fill='black')

    for i in range(13):
        x_position = 450 + i * 130
        y_position = 380
        width_rect = 100
        height_rect = 120
        draw.rectangle([x_position, y_position, x_position + width_rect, y_position + height_rect], outline='black', width=3)
        position_data["studentID"].append([x_position, y_position, x_position + width_rect, y_position + height_rect])

    with open("positions.json", 'w') as file:
        json.dump(position_data, file, indent=4)

    return image, draw, position_data

@app.route('/generate', methods=['POST'])
def generate_paper():
    global base_x, base_y, previous_case 

    data = request.get_json()
    selected_case = data.get('selected_case')
    range_input = data.get('range_input')
    subject_id = data.get('subject_id')
    page_number = data.get('page_number')

    start, end = map(int, range_input.split())

    image, draw, position_data = create_paper(subject_id, page_number)

    if previous_case is not None and previous_case != selected_case:
        base_x = 310
        base_y += spacing_y

    previous_case = selected_case

    match selected_case:
        case 'Case1':
            for i in range(start, end + 1):
                if base_x > 2180:
                    base_x = 310
                    base_y += spacing_y
                elif base_y > 3300:
                    print("เพิ่มสูงสุดได้เท่านี้!")
                    break

                draw.text((base_x - 100, base_y), f"No.", font=font, fill="black")
                draw.text((base_x - 100, base_y + 120), f"{i}", font=font, fill="black")
                rect_position = [base_x, base_y + 70, base_x + 100, base_y + 70 + 120]
                draw.rectangle(rect_position, outline="black", width=3)
                position_data[str(i)] = rect_position
                base_x += spacing_x

        case 'Case2':
            for i in range(start, end + 1):
                if base_x > 2180:
                    base_x = 310
                    base_y += spacing_y
                elif base_y > 3300:
                    print("เพิ่มสูงสุดได้เท่านี้!")
                    break

                draw.text((base_x - 100, base_y), f"No.", font=font, fill="black")
                draw.text((base_x - 100, base_y + 120), f"{i}", font=font, fill="black")
                rect_position1 = [base_x, base_y + 70, base_x + 100, base_y + 70 + 120]
                rect_position2 = [base_x + 100 + 20, base_y + 70, base_x + 2 * 100 + 20, base_y + 70 + 120]
                draw.rectangle(rect_position1, outline="black", width=3)
                draw.rectangle(rect_position2, outline="black", width=3)
                position_data[str(i)] = [rect_position1, rect_position2]
                base_x += spacing_x

        case 'Case3':
            for i in range(start, end + 1):
                if base_y > 3300:
                    print("เพิ่มสูงสุดได้เท่านี้!")
                    break

                num_lines = 3  
                draw.text((base_x - 100, base_y), f"No.", font=font, fill="black")
                draw.text((base_x - 100, base_y + 120), f"{i}", font=font, fill="black")

                line_positions = []
                for line in range(num_lines):
                    rect_position = [base_x, base_y + 70 + line * (120 + 30), base_x + 18 * 100, base_y + 70 + 120 + line * (120 + 30)]
                    draw.rectangle(rect_position, outline="black", width=3)
                    line_positions.append(rect_position)

                position_data[str(i)] = line_positions
                base_y += num_lines * (120 + 50) + 100

    with open("positions.json", 'w') as file:
        json.dump(position_data, file, indent=4)

    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    return jsonify({"image": img_str}), 200

@app.route('/reset', methods=['POST'])
def reset_positions():
    global base_x, base_y, previous_case  # ใช้ตัวแปร global
    base_x = 310
    base_y = 650
    previous_case = None
    return jsonify({"status": "reset done"}), 200

if __name__ == '__main__':
    app.run(debug=True)
