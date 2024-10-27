# กำหนดตัวแปรที่ต้องการให้เป็น global variables
case_array = []
range_input_array = []
type_point_array = []
option_array = []
subject_id = 0
part = 0

def update_variable(new_subject_id, new_part):
    global subject_id, part

    subject_id = new_subject_id
    part = new_part

    print("Updated Subject ID:", subject_id)
    print("Updated Part:", part)

def process_parts_data(new_case_array, new_range_input_array, new_type_point_array, new_option_array):
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
 

def reset():
    global case_array, range_input_array, type_point_array, option_array, subject_id, part

    case_array = []
    range_input_array = []
    type_point_array = []
    option_array = []
    subject_id = 0
    part = 0