import sys
from pdf2image import convert_from_path

# กำหนดตัวแปรที่ต้องการให้เป็น global variables
subject_id = 0
page_no = 0
 
def new_variable(new_subject_id, new_page_no):
    global subject_id, page_no

    subject_id = new_subject_id
    page_no = new_page_no
     
    print("Updated Subject ID:", subject_id)
    print("Updated page_no:", page_no)


def count_pdf_pages(pdf_file):
    # แปลง PDF เป็นรูปภาพโดยไม่บันทึกไฟล์
    images = convert_from_path(pdf_file)
    num_pages = len(images)
    print(f"Number of pages extracted: {num_pages}")
    return num_pages

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python predict.py <pdf_file>")
        sys.exit(1)

    pdf_file = sys.argv[1]
    try:
        page_count = count_pdf_pages(pdf_file)
        print({"success": True, "message": f"Total pages: {page_count}"})
    except Exception as e:
        print({"success": False, "message": str(e)})
