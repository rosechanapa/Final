import os
import cv2
import numpy as np

def process_pdf(pdf_document, output_folder):
    for page_number in range(len(pdf_document)):
        # แปลงหน้า PDF เป็น pixmap (ภาพ)
        page = pdf_document[page_number]
        pix = page.get_pixmap(dpi=300)  # ใช้ DPI สูงเพื่อความคมชัด
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

        # แปลงภาพเป็นรูปแบบที่ OpenCV ใช้งานได้
        if pix.n == 4:  # ตรวจสอบว่ามีช่อง Alpha หรือไม่
            img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
        else:
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

        # ขนาดมาตรฐานของกระดาษ A4
        width, height = 2480, 3508
        img_resized = cv2.resize(img, (width, height))

        # เปลี่ยนเป็นสีเทาและ Threshold
        gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)

        # ค้นหา Contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        detected_boxes = []

        for contour in contours:
            approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
            if len(approx) == 4:  # ตรวจสอบว่าสี่เหลี่ยมมี 4 ด้าน
                x, y, w, h = cv2.boundingRect(approx)
                if 50 < w < 200 and 50 < h < 200:  # กรองขนาดของกล่องสี่เหลี่ยม
                    detected_boxes.append((x, y, x + w, y + h))

        # ถ้ามีกล่อง 4 กล่องขึ้นไปให้ทำการแปลงมุมมอง
        if len(detected_boxes) >= 4:
            detected_boxes[2], detected_boxes[-2] = detected_boxes[-2], detected_boxes[2]
            detected_boxes[3], detected_boxes[-1] = detected_boxes[-1], detected_boxes[3]

            box_1, box_2, box_3, box_4 = detected_boxes[:4]

            src_points = np.array([
                [box_4[0], box_4[1]],
                [box_3[2], box_3[1]],
                [box_2[0], box_2[3]],
                [box_1[2], box_1[3]]
            ], dtype='float32')

            dst_points = np.array([
                [150, 100],
                [2330, 100],
                [150, 3408],
                [2330, 3408]
            ], dtype='float32')

            matrix, _ = cv2.findHomography(src_points, dst_points, cv2.RANSAC, 3.0)
            warped_image = cv2.warpPerspective(img_resized, matrix, (2480, 3508), borderMode=cv2.BORDER_REPLICATE)

            gray = cv2.cvtColor(warped_image, cv2.COLOR_BGR2GRAY)
            _, mask = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)

            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            if contours:
                max_contour = max(contours, key=cv2.contourArea)
                x, y, w, h = cv2.boundingRect(max_contour)
                cropped_image = warped_image[y:y+h, x:x+w]
                resized_image = cv2.resize(cropped_image, (2480, 3508))
            else:
                resized_image = warped_image
        else:
            resized_image = img_resized

        output_path = os.path.join(output_folder, f"page_{page_number + 1}.jpg")
        cv2.imwrite(output_path, resized_image)
        print(f"บันทึกภาพ: {output_path}")

    print("การประมวลผลเสร็จสมบูรณ์")