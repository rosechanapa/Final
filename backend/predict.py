import sys
from pdf2image import convert_from_path

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
