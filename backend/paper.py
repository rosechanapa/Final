from PIL import Image, ImageDraw, ImageFont
import io
import json
import os
import base64

# กำหนดฟอนต์ที่ใช้
font_path = "./font/DejaVuSans.ttf"
font = ImageFont.truetype(font_path, 45)
font_large = ImageFont.truetype(font_path, 60)
font_thai = ImageFont.truetype("./font/THSarabunNew Bold.ttf", 65)

# ตัวแปร global เพื่อเก็บสถานะต่างๆ
box_width = 100   
box_height = 120  
base_x = 310
base_y = 650
previous_case = None
spacing_x = 350
spacing_y = 300
begin_y = 450

image = None
draw = None
first_image_data = None
current_page_number = None
start_number = None 


# สร้างโฟลเดอร์ถ้ายังไม่มี
os.makedirs("./paper_exam", exist_ok=True)
os.makedirs("./positions", exist_ok=True)

def save_position_to_json(data, page_number):
    file_name = f"positions_{page_number}.json"
    file_path = os.path.join("./positions", file_name)  # บันทึกในโฟลเดอร์ ./positions
    
    # ถ้าไฟล์มีอยู่แล้ว ให้โหลดข้อมูลเดิมออกมาก่อน
    if os.path.exists(file_path):
        with open(file_path, 'r') as file:
            existing_data = json.load(file)
    else:
        existing_data = {}

    # รวมข้อมูลใหม่เข้ากับข้อมูลเดิม
    for key, value in data.items():
        if key in existing_data:
            existing_data[key].extend(value if isinstance(value, list) else [value])
        else:
            existing_data[key] = value if isinstance(value, list) else [value]

    # เขียนข้อมูลที่รวมกันแล้วกลับลงไฟล์
    with open(file_path, 'w') as file:
        json.dump(existing_data, file, indent=4)


def create_paper(subject_id, page_number):
    global first_image_data, image, draw, current_page_number
    width, height = 2480, 3508
    image = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(image)

    file_name = f"positions_{page_number}.json"
    if os.path.exists(file_name):
        os.remove(file_name)

    position_data = {
        "studentID": []
    }

    # เขียนข้อมูลส่วนหัว
    draw.text((210, 200), f"{subject_id}", font=font, fill='black')
    draw.text((490, 200), "Name  ______________________________________________", font=font, fill='black')
    draw.text((1720, 200), f"section ________", font=font, fill='black')
    draw.text((2100, 200), f"page {page_number}", font=font, fill='black')
    draw.text((210, 450), "studentID", font=font, fill='black')

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


    for x_position in [left_x, center_x, right_x]:
        draw.rectangle([x_position, y_position, x_position + box_width, y_position + box_height], fill='black', width=3)
              

    save_position_to_json(position_data, page_number)  # บันทึกตำแหน่งในไฟล์ JSON

    # เก็บข้อมูลภาพในตัวแปร first_image_data
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    first_image_data = buffered.getvalue()

    # เก็บค่า page_number ปัจจุบัน
    current_page_number = page_number

    return first_image_data

def generate_paper(selected_case, range_input, type_input):
    global base_x, base_y, previous_case, image, draw, first_image_data, current_page_number, start_number

    total_questions = 0 
    start_number = int(start_number)

    file_name = f"positions_{current_page_number}.json"
    if os.path.exists(file_name):
        with open(file_name, 'r') as file:
            position_data = json.load(file)
    else:
        position_data = {}

    if image is None or draw is None:
        if first_image_data is not None:
            image = Image.open(io.BytesIO(first_image_data))
            draw = ImageDraw.Draw(image)
            first_image_data = None
        else:
            image = Image.new('RGB', (2480, 3508), color='white')
            draw = ImageDraw.Draw(image)

    if previous_case is not None :
        base_x = 310
        base_y += begin_y

    previous_case = selected_case

    if base_y + 190 + box_height > 3300:
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
        return img_str, "Reached max height"

    match selected_case:
        case 'Case1':
            if type_input == 'number':
                draw.text((base_x - 100, base_y - 20), "เติมตัวเลขลงในช่อง", font=font_thai, fill="black")
            else:
                draw.text((base_x - 100, base_y - 20), "เติมตัวอักษรลงในช่อง", font=font_thai, fill="black")

            for i in range(start_number, start_number + range_input):
                if base_x > 2180:
                    base_x = 310
                    base_y += spacing_y
                    
                if base_y + 190 + box_height > 3300:
                    print("เพิ่มสูงสุดได้เท่านี้!")
                    break
                
                if (i - start_number) < 6:
                    draw.text((base_x - 100, base_y + 120), f"No.", font=font, fill="black")
                
                draw.text((base_x - 100, base_y + 220), f"{total_questions + i}", font=font, fill="black")
                rect_position = [base_x, base_y + 190, base_x + box_width, base_y + 190 + box_height]
                draw.rectangle(rect_position, outline="black", width=3)
                position_data[str(i)] = {
                    "position": rect_position,
                    "label": type_input
                }
                base_x += spacing_x
                
            total_questions += range_input

        case 'Case2':
            draw.text((base_x - 100, base_y - 20), "เติมตัวเลขลงในช่อง", font=font_thai, fill="black")

            for i in range(start_number, start_number + range_input):
                if base_x > 2180:
                    base_x = 310
                    base_y += spacing_y
                    
                if base_y + 190 + box_height > 3300:
                    print("เพิ่มสูงสุดได้เท่านี้!")
                    break
                
                if (i - start_number) < 6:
                    draw.text((base_x - 100, base_y + 120), f"No.", font=font, fill="black")
                    
                draw.text((base_x - 100, base_y + 220), f"{i}", font=font, fill="black")
                rect_position1 = [base_x, base_y + 190, base_x + box_width, base_y + 190 + box_height]
                rect_position2 = [base_x + box_width + 30, base_y + 190, base_x + 2 * box_width + 30, base_y + 190 + box_height]
                draw.rectangle(rect_position1, outline="black", width=3)
                draw.rectangle(rect_position2, outline="black", width=3)
                position_data[str(i)] = {
                    "position": [rect_position1, rect_position2],
                    "label": "number"
                }
                base_x += spacing_x
                
            total_questions += range_input

        case 'Case3':
            draw.text((base_x - 100, base_y-20), "เติมคำหรือประโยคลงในช่อง โดยเขียนให้อยู่กึ่งกลางของช่อง เช่น", font=font_thai, fill="black")

            special_rect_position = [base_x + 1100, base_y - 30, base_x + 1600, base_y + 80]
            draw.rectangle(special_rect_position, outline="black", width=3)

            text = "Example"
            text_bbox = draw.textbbox((0, 0), text, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            text_x = special_rect_position[0] + (special_rect_position[2] - special_rect_position[0] - text_width) / 2
            text_y = special_rect_position[1] + (special_rect_position[3] - special_rect_position[1] - text_height) / 2 - 10
            draw.text((text_x, text_y), text, font=font_thai, fill="black")

            for i in range(start_number, start_number + range_input):
                if base_y + 190 + box_height > 3300:
                    print("เพิ่มสูงสุดได้เท่านี้!")
                    break
                
                if (i - start_number) == 0:
                    draw.text((base_x - 100, base_y + 120), f"No.", font=font, fill="black")
                    
                draw.text((base_x - 100, base_y + 220), f"{i}", font=font, fill="black")

            
                rect_position = [base_x, base_y + 190, base_x + 1830, base_y + 190 + box_height]
                draw.rectangle(rect_position, outline="black", width=3)
                
                position_data[str(i)] = {
                    "position": rect_position,
                    "label": "text"
                }
                base_y += spacing_y
                
            base_y -= spacing_y
            total_questions += range_input

        case 'Case4':
            draw.text((base_x - 100, base_y - 20), "เติมตัวอักษร T หรือ F ลงในช่อง", font=font_thai, fill="black")

            for i in range(start_number, start_number + range_input):
                if base_x > 2180:
                    base_x = 310
                    base_y += spacing_y
                    
                if base_y + 190 + box_height > 3300:
                    print("เพิ่มสูงสุดได้เท่านี้!")
                    break
                if (i - start_number) < 6:
                    draw.text((base_x - 100, base_y + 120), f"No.", font=font, fill="black")
                    
                draw.text((base_x - 100, base_y + 220), f"{i}", font=font, fill="black")
                rect_position = [base_x, base_y + 190, base_x + box_width, base_y + 190 + box_height]
                draw.rectangle(rect_position, outline="black", width=3)
                position_data[str(i)] = {
                    "position": rect_position,
                    "label": "character"
                }
                base_x += spacing_x
                
            total_questions += range_input

    # อัปเดต start_number ให้เป็น global
    start_number += range_input

    save_position_to_json(position_data, current_page_number)  # บันทึกตำแหน่งในไฟล์ JSON

    # บันทึกภาพหลังจากวาดเสร็จ
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    return img_str, "OK"

def reset_positions():
    global base_x, base_y, previous_case, image, draw, first_image_data, current_page_number, start_number 

    if image is not None:
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        file_name = f"image_{current_page_number}.png"  
        file_path = os.path.join("./paper_exam", file_name)  # บันทึกในโฟลเดอร์ ./paper_exam
        with open(file_path, "wb") as out_file:
            out_file.write(buffered.getvalue())

    base_x = 310
    base_y = 650
    previous_case = None
    first_image_data = None
    current_page_number = None  
    start_number = None 
    image = None
    draw = None
