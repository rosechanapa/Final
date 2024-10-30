from PIL import Image, ImageDraw, ImageFont
import matplotlib.pyplot as plt
import os
import json
import glob


# กำหนดฟอนต์ที่ใช้
font_path = "./font/DejaVuSans.ttf"
font = ImageFont.truetype(font_path, 45)
font_large = ImageFont.truetype(font_path, 60)
font_thai = ImageFont.truetype("./font/THSarabunNew Bold.ttf", 65)

# กำหนดตัวแปรที่ต้องการให้เป็น global variables
subject_id = 0
part = 0

case_array = []
range_input_array = []
type_point_array = []
option_array = []

box_width = 100  # ความกว้างของกล่อง
box_height = 120  # ความสูงของกล่อง
base_x = 310  # กำหนดตำแหน่งเริ่มต้น x
base_y = 650  # กำหนดตำแหน่งเริ่มต้น y
spacing_x = 350  # ระยะห่างระหว่างกล่องในแนวนอน
spacing_y = 300  # ระยะห่างระหว่างกล่องในแนวตั้ง
begin_y = 450

previous_case = None  # เก็บค่า case ก่อนหน้า

page_number = 1
start_number = 1

position_data = {
    "studentID": []
}

# สร้าง list เพื่อเก็บภาพที่สร้างขึ้น
images = []

# สร้างโฟลเดอร์ถ้ายังไม่มี
os.makedirs("./exam_sheet", exist_ok=True)
os.makedirs("./positions", exist_ok=True)

################################

# ฟังก์ชันสำหรับบันทึกตำแหน่งในไฟล์ JSON
def save_position_to_json(data, page_number, overwrite=False):
    folder = './positions'
    file_name = f"{folder}/positions_{page_number}.json"

    # ถ้ามีไฟล์อยู่และไม่ต้องการเขียนทับ ให้โหลดข้อมูลเดิมและเพิ่มข้อมูลใหม่เข้าไป
    if os.path.exists(file_name) and not overwrite:
        with open(file_name, 'r') as file:
            existing_data = json.load(file)
        # รวมข้อมูลใหม่กับข้อมูลเดิม
        existing_data.update(data)
        data = existing_data

    # เขียนข้อมูลลงไฟล์ JSON
    with open(file_name, 'w') as file:
        json.dump(data, file, indent=4)

def set_newpaper():
    global base_x, base_y, previous_case, position_data
    base_x = 310
    base_y = 650
    previous_case = None
    position_data = {
        "studentID": []
    }

def set3_newpaper():
    global base_x, base_y, previous_case, position_data
    base_x = 310
    base_y = 950
    previous_case = None
    position_data = {
        "studentID": []
    }

# ฟังก์ชันสำหรับสร้างกระดาษคำตอบ
def create_paper(subject_id, page_number):
    global base_x, base_y, previous_case, position_data
    # ขนาดของกระดาษ A4
    width, height = 2480, 3508

    # สร้างพื้นหลังขาวสำหรับกระดาษคำตอบ
    image = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(image)

    # เขียนข้อมูลส่วนหัว
    draw.text((210, 200), f"{subject_id}", font=font, fill='black')
    draw.text((490, 200), "Name  ______________________________________________", font=font, fill='black')
    draw.text((1720, 200), "section _______", font=font, fill='black')
    draw.text((2100, 200), f"page {page_number}", font=font, fill='black')
    draw.text((210, 450), "studentID", font=font, fill='black')

    # วาดกรอบสำหรับ studentID และเก็บตำแหน่ง
    for i in range(13):
        x_position = 450 + i * 130
        y_position = 380
        width_rect = 100
        height_rect = 120
        draw.rectangle([x_position, y_position, x_position + width_rect, y_position + height_rect], outline='black', width=3)
        position_data["studentID"].append({
            "position": [x_position, y_position, x_position + width_rect, y_position + height_rect],
            "label": "number"
        })


    # กำหนดตำแหน่งของกล่องริมซ้ายสุด ตรงกลาง และขวาสุด
    left_x = 200  # กล่องซ้ายสุด ห่างจากขอบซ้าย 50 หน่วย
    center_x = (width - box_width) // 2  # กล่องตรงกลาง กึ่งกลางหน้ากระดาษ
    right_x = width - 200 - box_width  # กล่องขวาสุด ห่างจากขอบขวา 50 หน่วย

    # ตำแหน่ง y (อยู่ส่วนล่างของกระดาษ)
    y_position = height - 200  # ปรับให้กล่องอยู่ล่างสุดของหน้ากระดาษ

    # วาดกล่องทั้งสาม
    for x_position in [left_x, center_x, right_x]:
        draw.rectangle([x_position, y_position, x_position + box_width, y_position + box_height], fill='black', width=3)


    # บันทึกข้อมูลตำแหน่งในไฟล์ JSON โดยใช้ overwrite=True เพื่อสร้างไฟล์ใหม่
    save_position_to_json(position_data, page_number, overwrite=True)

    return image


################################

# update student_id & part
def update_variable(new_subject_id, new_part):
    global subject_id, part

    subject_id = new_subject_id
    part = new_part

    print("Updated Subject ID:", subject_id)
    print("Updated Part:", part)

# update input to array
def update_array(new_case_array, new_range_input_array, new_type_point_array, new_option_array):
    global case_array, range_input_array, type_point_array, option_array

    # อัพเดตอาร์เรย์ด้วยข้อมูลใหม่ที่รับมา
    case_array.extend(new_case_array)
    range_input_array.extend(new_range_input_array)
    type_point_array.extend(new_type_point_array)
    option_array.extend(new_option_array)

    print("Updated Case Array:", case_array)
    print("Updated Range Input Array:", range_input_array)
    print("Updated Type Point Array:", type_point_array)
    print("Updated Option Array:", option_array)

    # เริ่มต้นวาดบนหน้าแรก
    image = create_paper(subject_id, page_number)
    
    # หรือบันทึกภาพในไฟล์ (หากต้องการบันทึกเป็นภาพ)
    image.save(f"./exam_sheet/page_{page_number}.png")


# reset array เพื่อรับ input ทั้งหมดตั้งแต่หน้าแรก
def reset():
    global case_array, range_input_array, type_point_array, option_array, subject_id, part

    case_array = []
    range_input_array = []
    type_point_array = []
    option_array = []
    subject_id = 0
    part = 0