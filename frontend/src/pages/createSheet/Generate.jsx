import React, { useState, useEffect } from "react";
import "../../css/createExamsheet.css";
import { Card, Pagination, Modal } from "antd";
import Button from "../../components/Button";
import { useNavigate } from "react-router-dom";
import { ExclamationCircleFilled } from "@ant-design/icons";

const Generate = () => {
  const [images, setImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 1;
  const navigate = useNavigate();

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

  const handleSaveImages = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/save_images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ images }), // ส่ง base64 ของภาพไปใน body
      });

      if (response.ok) {
        alert("บันทึกภาพกระดาษคำตอบเรียบร้อยแล้ว");
        navigate("/ViewExamsheet");
      } else {
        alert("เกิดข้อผิดพลาดในการบันทึกภาพ");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleExit = () => {
    Modal.confirm({
      title: "ต้องการสร้างกระดาษคำตอบใหม่หรือไม่ ?",
      icon: <ExclamationCircleFilled />,
      content: "เมื่อกดตกลงแล้ว กระดาษคำตอบที่คุณเพิ่งสร้างจะถูกลบ",
      width: 550,
      className: "custom-modal",
      okText: "ตกลง",
      cancelText: "ยกเลิก",
      onOk: async () => {
        try {
          await fetch("http://127.0.0.1:5000/reset", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });
          navigate("/ExamPart");
        } catch (error) {
          console.error("Error resetting data:", error);
        }
      },
    });
  };

  const startIndex = (currentPage - 1) * itemsPerPage;
  const selectedImages = images.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div>
      <h1 className="Title">สร้างกระดาษคำตอบ</h1>
      <Card
        title="กรุณาตรวจสอบกระดาษคำตอบก่อนกดบันทึก"
        className="card-edit"
        style={{
          width: "100%",
          margin: "0 auto",
          height: "auto",
        }}
      >
        {selectedImages.map((imgSrc, index) => (
          <div key={index} style={{ textAlign: "center" }}>
            <img
              src={`data:image/png;base64,${imgSrc}`}
              alt={`Generated ${startIndex + index}`}
              style={{
                width: "50%",
                margin: "30px auto",
                borderRadius: 8,
                boxShadow: "0px 2px 2px 3px rgba(208, 216, 238, 0.35)",
              }}
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
        <div className="Buttoncase2-container">
          <Button variant="light" size="md" onClick={handleExit}>
            สร้างใหม่อีกครั้ง
          </Button>
          <Button variant="primary" size="md" onClick={handleSaveImages}>
            บันทึก
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Generate;
