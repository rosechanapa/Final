import React, { useState, useEffect } from "react";
import "../../css/createExamsheet.css";
import { Card, Pagination } from "antd";

const Generate = () => {
  const [images, setImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 1; // แสดงภาพละ 1 รายการต่อหน้า

  useEffect(() => {
    // ดึงข้อมูลภาพจาก API
    const fetchImages = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/get_images");
        const data = await response.json();
        if (data.status === "success") {
          setImages(data.images);
        }
      } catch (error) {
        console.error("Error fetching images:", error);
      }
    };
    fetchImages();
  }, []);

  // คำนวณ index ของภาพที่จะเริ่มแสดง
  const startIndex = (currentPage - 1) * itemsPerPage;
  const selectedImages = images.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div>
      <h1 className="Title">Generate Examsheet</h1>
      <Card
        title="กรุณาตรวจสอบกระดาษคำตอบก่อนกดบันทึก"
        className="card-edit"
        style={{
          width: "100%",
          minHeight: 600,
          margin: "0 auto",
          height: "auto",
        }}
      >
        {selectedImages.map((imgSrc, index) => (
          <div key={index} style={{ textAlign: "center" }}>
            <img
              src={`data:image/png;base64,${imgSrc}`}
              alt={`Generated ${startIndex + index}`}
              className="image-style"
            />
          </div>
        ))}
        <div className="pagination-container">
          <Pagination
            current={currentPage}
            total={images.length}
            pageSize={itemsPerPage}
            onChange={(page) => setCurrentPage(page)}
          />
        </div>
      </Card>
    </div>
  );
};

export default Generate;
