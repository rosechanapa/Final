from PIL import Image, ImageDraw, ImageFont
import os
import json
import glob
import base64
from io import BytesIO
import math

stop_flag = False
# กำหนดฟอนต์ที่ใช้
font_path = "./font/DejaVuSans.ttf"
font = ImageFont.truetype(font_path, 45)
font_large = ImageFont.truetype(font_path, 60)
font_thai = ImageFont.truetype("./font/THSarabunNew Bold.ttf", 65)

# กำหนดตัวแปรที่ต้องการให้เป็น global variables
subject_id = 0
part = 0
page_number = 1
name_position = 1

case_array = []
range_input_array = []
option_array = []

box_width = 100  # ความกว้างของกล่อง
box_height = 120  # ความสูงของกล่อง
base_x = 310  # กำหนดตำแหน่งเริ่มต้น x
base_y = 650  # กำหนดตำแหน่งเริ่มต้น y
spacing_x = 350  # ระยะห่างระหว่างกล่องในแนวนอน
spacing_y = 300  # ระยะห่างระหว่างกล่องในแนวตั้ง
begin_y = 450
boxw = 100
boxh = 100


previous_case = None  # เก็บค่า case ก่อนหน้า
image, draw = None, None

start_number = 1

position_data = {
    "studentID": []
}

column_shift = 1500

# สร้าง list เพื่อเก็บภาพที่สร้างขึ้น
images = []

# สร้าง dictionary สำหรับเก็บ index และจำนวนบรรทัด
lines_dict = {}
sum_input = 0


################################

# ฟังก์ชันสำหรับบันทึกตำแหน่งในไฟล์ JSON
def save_position_to_json(data, overwrite=False):
    folder = f'./{subject_id}/positions'
    file_name = f"{folder}/positions_{name_position}.json"

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
    draw.text((150, 270), f"{subject_id}", font=font, fill='black')
    draw.text((430, 270), "Name (In Thai)____________________________________________", font=font, fill='black')
    draw.text((1800, 270), "section _______", font=font, fill='black')
    draw.text((2150, 270), f"page {page_number}", font=font, fill='black')
    draw.text((210, 480), "studentID", font=font, fill='black')

    # วาดกรอบสำหรับ studentID และเก็บตำแหน่ง
    for i in range(13):
        x_position = 480 + i * 130
        y_position = 410
        width_rect = 100
        height_rect = 120
        draw.rectangle([x_position, y_position, x_position + width_rect, y_position + height_rect], outline='black', width=3)
        position_data["studentID"].append({
            "position": [x_position, y_position, x_position + width_rect, y_position + height_rect],
            "label": "id"
        })


    # กำหนดตำแหน่งของกล่องหัวมุมทั้งสี่
    top_left_x = 150  # บนซ้าย
    top_left_y = 100

    top_right_x = width - 150 - boxw  # บนขวา
    top_right_y = 100

    bottom_left_x = 150  # ล่างซ้าย
    bottom_left_y = height - 100 - boxh

    bottom_right_x = width - 150 - boxw  # ล่างขวา
    bottom_right_y = height - 100 - boxh

    # วาดกล่องหัวมุมทั้งสี่
    corner_positions = [
        (top_left_x, top_left_y),
        (top_right_x, top_right_y),
        (bottom_left_x, bottom_left_y),
        (bottom_right_x, bottom_right_y)
    ]

    for x, y in corner_positions:
        draw.rectangle([x, y, x + boxw, y + boxh], fill='black', width=3)

    # บันทึกข้อมูลตำแหน่งในไฟล์ JSON โดยใช้ overwrite=True เพื่อสร้างไฟล์ใหม่
    save_position_to_json(position_data, overwrite=True)

    return image, draw


# ฟังก์ชันสำหรับสร้างกระดาษคำตอบ line
def create_paper_line(subject_id, page_number, line):
    global base_x, base_y, previous_case, position_data, name_position 

    set_newpaper()

    # ขนาดของกระดาษ A4
    width, height = 2480, 3508

    # สร้างพื้นหลังขาวสำหรับกระดาษคำตอบ
    image = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(image)

    # เขียนข้อมูลส่วนหัว
    draw.text((150, 270), f"{subject_id}", font=font, fill='black')
    draw.text((430, 270), "Name (In Thai)____________________________________________", font=font, fill='black')
    draw.text((1800, 270), "section _______", font=font, fill='black')
    draw.text((2150, 270), f"page {page_number}", font=font, fill='black')
    draw.text((210, 480), "studentID", font=font, fill='black')

    # วาดกรอบสำหรับ studentID และเก็บตำแหน่ง
    for i in range(13):
        x_position = 480 + i * 130
        y_position = 410
        width_rect = 100
        height_rect = 120
        draw.rectangle([x_position, y_position, x_position + width_rect, y_position + height_rect], outline='black', width=3)
        position_data["studentID"].append({
            "position": [x_position, y_position, x_position + width_rect, y_position + height_rect],
            "label": "id"
        })


    # กำหนดตำแหน่งของกล่องหัวมุมทั้งสี่
    top_left_x = 150  # บนซ้าย
    top_left_y = 100

    top_right_x = width - 150 - boxw  # บนขวา
    top_right_y = 100

    bottom_left_x = 150  # ล่างซ้าย
    bottom_left_y = height - 100 - boxh

    bottom_right_x = width - 150 - boxw  # ล่างขวา
    bottom_right_y = height - 100 - boxh

    # วาดกล่องหัวมุมทั้งสี่
    corner_positions = [
        (top_left_x, top_left_y),
        (top_right_x, top_right_y),
        (bottom_left_x, bottom_left_y),
        (bottom_right_x, bottom_right_y)
    ]

    for x, y in corner_positions:
        draw.rectangle([x, y, x + boxw, y + boxh], fill='black', width=3)

    # บันทึกข้อมูลตำแหน่งในไฟล์ JSON โดยใช้ overwrite=True เพื่อสร้างไฟล์ใหม่
    save_position_to_json(position_data, overwrite=True)

    sum_line = 0
    line_length = 2000
    spacing = 100


    for j in range(line):
        if base_y + (spacing*2) > 3200:
            # print("เพิ่มlineได้เท่านี้! ขึ้นหน้าใหม่\n")
            images.append(image.copy())
            page_number += 1
            name_position += 1
            set_newpaper()
            line -= sum_line
            image, draw = create_paper_line(subject_id, page_number, line)

            break

        line_start = (base_x, base_y + 100)  # Start point of the line
        line_end = (base_x + line_length, base_y + 100)  # End point of the line
        draw.line([line_start, line_end], fill="black", width=3)
        base_y += spacing  # Move to next line position
        sum_line += 1
        # print(f"j : {j}, base_y : {base_y}")

    base_y -= spacing

    previous_case = '6'
    # print(f"previous_case : {previous_case}")

    return image, draw


def draw_cases():
    global previous_case, position_data, case_array, range_input_array, option_array, page_number, start_number, base_x, base_y, image, draw, name_position 

    i = 0
    while i < len(case_array):
        case = case_array[i]
        range_input = range_input_array[i]
        option = option_array[i]
        sum_drawing = 0  # จำนวนข้อที่วาดไปแล้วในรอบนี้

        if previous_case is not None:
            base_x = 310
            base_y += begin_y

        previous_case = case

        if base_y + 190 + box_height > 3300:
            # print("เพิ่มcaseได้เท่านี้! ขึ้นหน้าใหม่\n")
            images.append(image.copy())
            page_number += 1
            name_position += 1
            set_newpaper()
            image, draw = create_paper(subject_id, page_number)

            continue

        # ใช้ match case เพื่อตรวจสอบและวาด
        match case:
            case '1':
                if option == 'number':
                    draw.text((base_x - 100, base_y - 20), "Write a number in each cell/เติมตัวเลขลงในช่อง", font=font_thai, fill="black")
                else:
                    draw.text((base_x - 100, base_y - 20), "Write a character in each cell/เติมตัวอักษรลงในช่อง", font=font_thai, fill="black")

                for j in range(start_number, start_number + int(range_input)):
                    if base_x > 2180:
                        base_x = 310
                        base_y += spacing_y

                    if base_y + 190 + box_height > 3300:
                        # print("เพิ่มboxได้เท่านี้! ขึ้นหน้าใหม่\n")
                        images.append(image.copy())
                        page_number += 1
                        name_position += 1
                        set_newpaper()
                        image, draw = create_paper(subject_id, page_number)

                        # ลดค่า range_input_array และวนกลับไปเริ่มใหม่
                        range_input_array[i] = int(range_input) - sum_drawing
                        break

                    # แสดง No. สำหรับ 6 ข้อแรกในแต่ละเคส (ยกเว้นเคส 3)
                    if (j - start_number) < 6:
                        draw.text((base_x - 100, base_y + 120), f"No.", font=font, fill="black")

                    draw.text((base_x - 100, base_y + 220), f"{j}", font=font, fill="black")
                    rect_position = [base_x, base_y + 190, base_x + box_width, base_y + 190 + box_height]
                    draw.rectangle(rect_position, outline="black", width=3)
                    
                    position_data[str(j)] = {
                        "position": rect_position,
                        "label": option
                    }
                    base_x += spacing_x
                    sum_drawing += 1

                    # บันทึกตำแหน่งทุกครั้งหลังวาดแต่ละข้อ
                    save_position_to_json(position_data)


            case '2':
                draw.text((base_x - 100, base_y - 20), "Write a number in each cell/เติมตัวเลขลงในช่อง", font=font_thai, fill="black")

                for j in range(start_number, start_number + int(range_input)):
                    if base_x > 2180:
                        base_x = 310
                        base_y += spacing_y

                    if base_y + 190 + box_height > 3300:
                        # print("เพิ่มboxได้เท่านี้! ขึ้นหน้าใหม่\n")
                        images.append(image.copy())
                        page_number += 1
                        name_position += 1
                        set_newpaper()
                        image, draw = create_paper(subject_id, page_number)

                        # ลดค่า range_input_array และวนกลับไปเริ่มใหม่
                        range_input_array[i] = int(range_input) - sum_drawing
                        break

                    # แสดง No. สำหรับ 6 ข้อแรกในแต่ละเคส
                    if (j - start_number) < 6:
                        draw.text((base_x - 100, base_y + 120), f"No.", font=font, fill="black")

                    draw.text((base_x - 100, base_y + 220), f"{j}", font=font, fill="black")
                    rect_position1 = [base_x, base_y + 190, base_x + box_width, base_y + 190 + box_height]
                    rect_position2 = [base_x + box_width + 30, base_y + 190, base_x + 2 * box_width + 30, base_y + 190 + box_height]
                    draw.rectangle(rect_position1, outline="black", width=3)
                    draw.rectangle(rect_position2, outline="black", width=3)
                    
                    position_data[str(j)] = {
                        "position": [rect_position1, rect_position2],
                        "label": option
                    }
                    base_x += spacing_x
                    sum_drawing += 1

                    # บันทึกตำแหน่งทุกครั้งหลังวาดแต่ละข้อ
                    save_position_to_json(position_data)


            case '3':
                draw.text((base_x - 100, base_y - 20), "เติมคำหรือประโยคลงในช่อง โดยเขียนให้อยู่กึ่งกลางของช่อง เช่น", font=font_thai, fill="black")

                special_rect_position = [base_x + 1100, base_y - 30, base_x + 1600, base_y + 80]
                draw.rectangle(special_rect_position, outline="black", width=3)

                text = "Example"
                text_bbox = draw.textbbox((0, 0), text, font=font)
                text_width = text_bbox[2] - text_bbox[0]
                text_height = text_bbox[3] - text_bbox[1]
                text_x = special_rect_position[0] + (special_rect_position[2] - special_rect_position[0] - text_width) / 2
                text_y = special_rect_position[1] + (special_rect_position[3] - special_rect_position[1] - text_height) / 2 - 10
                draw.text((text_x, text_y), text, font=font_thai, fill="black")

                for j in range(start_number, start_number + int(range_input)):
                    if base_y + 190 + box_height > 3300:
                        # print("เพิ่มboxได้เท่านี้! ขึ้นหน้าใหม่\n")
                        images.append(image.copy())
                        page_number += 1
                        name_position += 1
                        set3_newpaper()
                        image, draw = create_paper(subject_id, page_number)

                        # ลดค่า range_input_array และวนกลับไปเริ่มใหม่
                        range_input_array[i] = int(range_input) - sum_drawing
                        break

                    # แสดง No. สำหรับแค่ข้อแรก
                    if (j - start_number) == 0:
                        draw.text((base_x - 100, base_y + 120), f"No.", font=font, fill="black")

                    draw.text((base_x - 100, base_y + 220), f"{j}", font=font, fill="black")

                    rect_position = [base_x, base_y + 190, base_x + 1830, base_y + 190 + box_height]
                    draw.rectangle(rect_position, outline="black", width=3)
                    
                    position_data[str(j)] = {
                        "position": rect_position,
                        "label": option
                    }
                    base_y += spacing_y
                    sum_drawing += 1

                    # บันทึกตำแหน่งทุกครั้งหลังวาดแต่ละข้อ
                    save_position_to_json(position_data)

                base_y -= spacing_y


            case '4':
                draw.text((base_x - 100, base_y - 20), "Write T or F in each cell/เติมตัวอักษร T หรือ F ลงในช่อง", font=font_thai, fill="black")

                for j in range(start_number, start_number + int(range_input)):
                    if base_x > 2180:
                        base_x = 310
                        base_y += spacing_y

                    if base_y + 190 + box_height > 3300:
                        # print("เพิ่มboxได้เท่านี้! ขึ้นหน้าใหม่\n")
                        images.append(image.copy())
                        page_number += 1
                        name_position += 1
                        set_newpaper()
                        image, draw = create_paper(subject_id, page_number)

                        # ลดค่า range_input_array และวนกลับไปเริ่มใหม่
                        range_input_array[i] = int(range_input) - sum_drawing
                        break

                    # แสดง No. สำหรับ 6 ข้อแรกในแต่ละเคส
                    if (j - start_number) < 6:
                        draw.text((base_x - 100, base_y + 120), f"No.", font=font, fill="black")

                    draw.text((base_x - 100, base_y + 220), f"{j}", font=font, fill="black")
                    rect_position = [base_x, base_y + 190, base_x + box_width, base_y + 190 + box_height]
                    draw.rectangle(rect_position, outline="black", width=3)
                    
                    position_data[str(j)] = {
                        "position": rect_position,
                        "label": option
                    }
                    base_x += spacing_x
                    sum_drawing += 1

                    # บันทึกตำแหน่งทุกครั้งหลังวาดแต่ละข้อ
                    save_position_to_json(position_data)

            case '5':
                max_row = math.ceil(int(range_input) / 2)
                draw.text((base_x - 100, base_y - 20), "Mark X in the correct cell/เติมเครื่องหมายกากบาท (X) ลงในช่องที่ถูกต้อง", font=font_thai, fill="black")
                new_choice = 0
                current_y = base_y

                # Loop แรก
                for j in range(start_number, start_number + max_row):

                    if base_y + 190 + box_height > 3300:
                        # print("ขึ้นrowใหม่")
                        new_choice = 1

                        break

                    if (j - start_number) == 0:
                        draw.text((base_x - 100, base_y + 120), f"No.", font=font, fill="black")
                        draw.text((base_x + 30, base_y + 120), f"A", font=font, fill="black")
                        draw.text((base_x + box_width + 30 + 30, base_y + 120), f"B", font=font, fill="black")
                        draw.text((base_x + 2 * (box_width + 30) + 30, base_y + 120), f"C", font=font, fill="black")
                        draw.text((base_x + 3 * (box_width + 30) + 30, base_y + 120), f"D", font=font, fill="black")
                        draw.text((base_x + 4 * (box_width + 30) + 30, base_y + 120), f"E", font=font, fill="black")

                    # วาดข้อมูลตามที่กำหนด
                    draw.text((base_x - 100, base_y + 220), f"{j}", font=font, fill="black")

                    rect_position1 = [base_x, base_y + 190, base_x + box_width, base_y + 190 + box_height]
                    rect_position2 = [base_x + box_width + 30, base_y + 190, base_x + 2 * box_width + 30, base_y + 190 + box_height]
                    rect_position3 = [base_x + 2 * (box_width + 30), base_y + 190, base_x + 3 * box_width + 2 * 30, base_y + 190 + box_height]
                    rect_position4 = [base_x + 3 * (box_width + 30), base_y + 190, base_x + 4 * box_width + 3 * 30, base_y + 190 + box_height]
                    rect_position5 = [base_x + 4 * (box_width + 30), base_y + 190, base_x + 5 * box_width + 4 * 30, base_y + 190 + box_height]


                    draw.rectangle(rect_position1, outline="black", width=3)
                    draw.rectangle(rect_position2, outline="black", width=3)
                    draw.rectangle(rect_position3, outline="black", width=3)
                    draw.rectangle(rect_position4, outline="black", width=3)
                    draw.rectangle(rect_position5, outline="black", width=3)

                    position_data[str(j)] = {
                        "position": [rect_position1, rect_position2, rect_position3, rect_position4, rect_position5],
                        "label": option
                    }
                    base_y += spacing_y
                    max_y = base_y
                    sum_drawing += 1
                    save_position_to_json(position_data)

                # กำหนดค่าเริ่มต้น หลัง Loop แรกเสร็จ
                range_input_array[i] = int(range_input) - sum_drawing 
                base_x = column_shift
                base_y = current_y
                max_draw = sum_drawing
                start_k = sum_drawing + start_number

                # Loop ที่สอง
                for k in range(start_k, start_k + max_draw):
                    if k - start_k == range_input_array[i]:
                        # print("เพิ่มrowได้เท่านี้!\n")
                        break
 
                    if k == start_k:
                        draw.text((base_x - 100, base_y + 120), f"No.", font=font, fill="black")
                        draw.text((base_x + 30, base_y + 120), f"A", font=font, fill="black")
                        draw.text((base_x + box_width + 30 + 30, base_y + 120), f"B", font=font, fill="black")
                        draw.text((base_x + 2 * (box_width + 30) + 30, base_y + 120), f"C", font=font, fill="black")
                        draw.text((base_x + 3 * (box_width + 30) + 30, base_y + 120), f"D", font=font, fill="black")
                        draw.text((base_x + 4 * (box_width + 30) + 30, base_y + 120), f"E", font=font, fill="black")

                    draw.text((base_x - 100, base_y + 220), f"{k}", font=font, fill="black")

                    rect_position1 = [base_x, base_y + 190, base_x + box_width, base_y + 190 + box_height]
                    rect_position2 = [base_x + box_width + 30, base_y + 190, base_x + 2 * box_width + 30, base_y + 190 + box_height]
                    rect_position3 = [base_x + 2 * (box_width + 30), base_y + 190, base_x + 3 * box_width + 2 * 30, base_y + 190 + box_height]
                    rect_position4 = [base_x + 3 * (box_width + 30), base_y + 190, base_x + 4 * box_width + 3 * 30, base_y + 190 + box_height]
                    rect_position5 = [base_x + 4 * (box_width + 30), base_y + 190, base_x + 5 * box_width + 4 * 30, base_y + 190 + box_height]


                    draw.rectangle(rect_position1, outline="black", width=3)
                    draw.rectangle(rect_position2, outline="black", width=3)
                    draw.rectangle(rect_position3, outline="black", width=3)
                    draw.rectangle(rect_position4, outline="black", width=3)
                    draw.rectangle(rect_position5, outline="black", width=3)

                    position_data[str(k)] = {
                        "position": [rect_position1, rect_position2, rect_position3, rect_position4, rect_position5],
                        "label": option
                    }
                    base_y += spacing_y
                    sum_drawing += 1
                    save_position_to_json(position_data)


                if new_choice == 1:
                    images.append(image.copy())
                    page_number += 1
                    name_position += 1
                    set_newpaper()
                    image, draw = create_paper(subject_id, page_number)
                    range_input_array[i] = int(range_input) - sum_drawing
                    
                elif sum_drawing % 2 == 0:  # กรณีที่ไม่ต้องขึ้นกระดาษใหม่ 
                    base_y -= spacing_y

            case '6':
                draw.text((base_x - 100, base_y - 20), "Write an answer in each line/เขียนคำตอบลงในบรรทัดด้านล่าง", font=font_thai, fill="black")
                spacing = 100
                line_length = 2000


                for k in range(start_number, start_number + int(range_input)):
                    # print(f"k : {k} , base_y : {base_y} ")

                    sum_line = 0
                    if base_y + (spacing*2) > 3200:
                        print("เพิ่มข้อได้เท่านี้! ขึ้นหน้าใหม่\n")
                        images.append(image.copy())
                        page_number += 1
                        name_position += 1
                        range_input_array[i] = int(range_input) - sum_drawing
                        set3_newpaper()
                        image, draw = create_paper(subject_id, page_number)

                        break

                    draw.text((base_x - 100, base_y + 150), f"{k}", font=font, fill="black")  # ใช้ k+1 ในการแสดงข้อความ

                    if (k-1) in lines_dict:
                        # print(f"ข้อที่ : {k-1}, lines_dict[k-1] : {lines_dict[k-1]}")
                        for j in range(lines_dict[k-1]):
                            if base_y + (spacing*2) > 3200:
                                print("เพิ่มlineได้เท่านี้! ขึ้นหน้าใหม่\n")
                                images.append(image.copy())
                                page_number += 1
                                name_position += 1
                                #set_newpaper()
                                lines_dict[k-1] -= sum_line
                                image, draw = create_paper_line(subject_id, page_number, lines_dict[k-1])

                                break

                            line_start = (base_x, base_y + 190)  # Start point of the line
                            line_end = (base_x + line_length, base_y + 190)  # End point of the line
                            draw.line([line_start, line_end], fill="black", width=3)
                            base_y += spacing  # Move to next line position
                            sum_line += 1
                            # print(f"j : {j}, base_y : {base_y}")
                    else:
                        print(f"Warning: Key {k-1} not found in lines_dict. Skipping...")

                    base_y += spacing
                    sum_drawing += 1


                base_y -= spacing_y


        # อัปเดต start_number
        start_number += sum_drawing

        # เช็คว่าจบการวาดในเคสนั้นแล้วหรือยัง
        if sum_drawing == int(range_input):
            i += 1  # ไปทำ case ถัดไป
            # print(f"case ถัดไป")

        else:
            # print(f"ไม่ครบ case ขึ้นหน้าใหม่\n")

            continue  # ถ้าวาดไม่ครบให้วนกลับไปทำเคสเดิม

    # จบการวาดและบันทึกภาพ
    images.append(image.copy())

################################

def delete_files_in_directory(directory_path):
    files = glob.glob(f"{directory_path}/*")
    for file in files:
        if os.path.isfile(file):  # ตรวจสอบว่าไฟล์มีอยู่จริง
            os.remove(file)
    print(f"All files in {directory_path} have been deleted.")


# ฟังก์ชันเพื่อแปลงภาพใน list 'images' เป็น base64
def get_images_as_base64():
    base64_images = []
    for img in images:
        buffered = BytesIO()
        img.save(buffered, format="PNG")  # ใช้ PNG หรือ JPEG ตามความเหมาะสม
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        base64_images.append(img_str)
    return base64_images


################################

def start_create():
    global image, draw

    # เริ่มต้นวาดบนหน้าแรก
    image, draw = create_paper(subject_id, page_number)

    # เรียกฟังก์ชัน draw_cases หลังจากสร้างกระดาษ
    draw_cases()
    

# update student_id & part
def update_variable(new_subject_id, new_part, new_page):
    global subject_id, part, page_number

    subject_id = new_subject_id
    part = new_part
    page_number = new_page 

    print("Updated Subject ID:", subject_id)
    print("Updated Part:", part)
    print("Updated Page:", page_number)

# update input to array
def update_array(new_case_array, new_range_input_array, new_option_array, new_lines_dict_dict):
    global case_array, range_input_array, option_array, lines_dict 

    # อัปเดต array หลัก
    case_array.extend(new_case_array)
    range_input_array.extend(new_range_input_array)
    option_array.extend(new_option_array)

    # รวม lines_dict_array ที่ส่งมาเป็น dictionary
    if isinstance(new_lines_dict_dict, dict):
        for key, value in new_lines_dict_dict.items():
            try:
                # แปลง key และ value เป็น int ก่อนอัปเดต lines_dict
                int_key = int(key)
                int_value = int(value)
                lines_dict[int_key] = int_value
            except ValueError:
                print(f"Warning: Key {key} or Value {value} cannot be converted to int. Skipping...")
    else:
        raise ValueError("new_lines_dict_dict ต้องเป็น dictionary เท่านั้น")
    

    # สร้างโฟลเดอร์ถ้ายังไม่มี
    os.makedirs(f"./{subject_id}/positions", exist_ok=True)  # ใช้ f-string แทน

    # แสดงข้อมูลที่อัปเดต
    print("Updated Case Array:", case_array)
    print("Updated Range Input Array:", range_input_array)
    print("Updated Option Array:", option_array)
    print("Updated Lines Dict Array:", lines_dict)

    start_create()


# reset array เพื่อรับ input ทั้งหมดตั้งแต่หน้าแรก
def reset():
    global case_array, range_input_array, option_array, subject_id, part, previous_case, image, draw, page_number, start_number, position_data, images, base_x, base_y, lines_dict 

    case_array = []
    range_input_array = []
    option_array = []
    previous_case = None  # เก็บค่า case ก่อนหน้า
    image, draw = None, None

    base_x = 310  # กำหนดตำแหน่งเริ่มต้น x
    base_y = 650  # กำหนดตำแหน่งเริ่มต้น y

    subject_id = 0
    part = 0
    page_number = 1
    start_number = 1

    position_data = {
        "studentID": []
    }

    # สร้าง list เพื่อเก็บภาพที่สร้างขึ้น
    images = []

    lines_dict = {}

    # Delete files in specified directories
    # delete_files_in_directory("./exam_sheet")
    # delete_files_in_directory("./positions")