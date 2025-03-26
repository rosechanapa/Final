import "../css/viewExamsheet.css";
import { Table, Select, message, Modal } from "antd";
import React, { useState, useEffect } from "react";
import axios from "axios";
import Button from "../components/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import { PlusOutlined, MinusOutlined } from "@ant-design/icons";
import { useLocation } from "react-router-dom";
// import { jsPDF } from "jspdf";

const { Option } = Select;

const ViewExamsheet = () => {
  // const [searchParams] = useSearchParams();
  // const location = useLocation();
  // const { subject_id } = location.state || {}; // ดึง subject_id จาก state
  const [subjectList, setSubjectList] = useState([]);
  // const [subjectId, setSubjectId] = useState("");
  const [imageList, setImageList] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [scale, setScale] = useState(1);
  const { state } = useLocation();
  const [subjectId, setSubjectId] = useState(state?.subjectId || "");
  // const [selectedSubject, setSelectedSubject] = useState(subject_id || "");

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/view_subjects");
        const data = await response.json();
        console.log("Subjects Data:", data);

        setSubjectList(data);

        if (state?.subjectId) {
          setSubjectId(state.subjectId);
        } else if (data.length > 0) {
          setSubjectId(data[0].Subject_id);
        }
      } catch (error) {
        console.error("Error fetching subjects:", error);
      }
    };

    fetchSubjects();
  }, []);

  const handleSubjectChange = (value) => {
    setSubjectId(value);
  };

  const handleImageClick = (imagePath) => {
    const filename = imagePath.split("/").pop(); // ดึงเฉพาะชื่อไฟล์ เช่น "1.jpg"
    const fullImageUrl = `http://127.0.0.1:5000/get_image_subject/${subjectId}/${filename}`;
    console.log("Generated Full Image URL:", fullImageUrl); // Debugging
    setSelectedImage(fullImageUrl);
    setScale(1);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setSelectedImage(null);
    setIsModalVisible(false);
  };

  useEffect(() => {
    const fetchPages = async () => {
      if (!subjectId) return;
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/view_pages/${subjectId}`
        );
        if (response.data.status === "success") {
          setImageList(response.data.data); // เก็บข้อมูล image list
        } else {
          message.error(response.data.message);
        }
      } catch (error) {
        console.error("Error fetching pages:", error);
      }
    };

    fetchPages();
  }, [subjectId]);

  const handleDownload = (imageId) => {
    const downloadUrl = `http://127.0.0.1:5000/download_image/${subjectId}/${imageId}`;
    window.location.href = downloadUrl;
  };
  // ฟังก์ชันสำหรับดาวน์โหลด PDF
  const handleDownloadPDF = () => {
    const pdfUrl = `http://127.0.0.1:5000/download_pdf/${subjectId}`;
    window.location.href = pdfUrl; // ดาวน์โหลดไฟล์ PDF ทั้งหมด
  };

  const handleDelete = () => {
    Modal.confirm({
      title: (
        <div
          style={{
            fontSize: "14px ",
          }}
        >
          คุณต้องการรีเซ็ตข้อมูลทั้งหมดหรือไม่?
        </div>
      ),
      content: (
        <div
          style={{
            fontSize: "12px ",
          }}
        >
          การรีเซ็ต จะลบไฟล์และข้อมูลที่เกี่ยวข้องทั้งหมดสำหรับวิชานี้
        </div>
      ),

      okText: "ใช่",
      cancelText: "ไม่",
      width: 450,
      className: "custom-modal",
      onOk: async () => {
        try {
          const response = await axios.delete(
            `http://127.0.0.1:5000/reset/${subjectId}`
          );

          if (response.data.status === "reset done") {
            message.success("รีเซ็ตข้อมูลเรียบร้อยแล้ว");

            // รีเซ็ตรายการภาพใน Frontend
            setImageList([]);
          } else {
            message.error(response.data.message);
          }
        } catch (error) {
          console.error("Error resetting data:", error);
          message.error("เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล");
        }
      },
    });
  };

  const increaseZoom = () => {
    setScale((prevScale) => {
      const newScale = Math.min(prevScale + 0.1, 5);
      document.querySelector("div").scrollTop = 0; // รีเซ็ตการเลื่อนเมื่อซูม
      return newScale;
    });
  };

  const decreaseZoom = () => {
    setScale((prevScale) => Math.max(prevScale - 0.1, 1)); // ลดขนาดภาพ
  };

  const columns = [
    {
      title: <div style={{ paddingLeft: "30px" }}>ภาพที่</div>,
      dataIndex: "Page_no",
      key: "Page_no",
      width: 30,
      render: (text) => <div style={{ paddingLeft: "30px" }}>{text}</div>,
    },
    {
      title: "ตัวอย่างภาพ",
      dataIndex: "image_path",
      key: "image_path",
      width: 300,
      render: (text) => (
        <img
          src={`http://127.0.0.1:5000/get_image_subject/${subjectId}/${text
            .split("/")
            .pop()}`}
          alt="Example"
          className="show-img"
          onClick={() => handleImageClick(text)}
        />
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 150,
      render: (_, record) => (
        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            size="edit"
            varian="primary"
            onClick={() => handleDownload(record.Page_no)}
          >
            <DownloadIcon />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h1 className="Title">กระดาษคำตอบที่สร้าง</h1>
      <div className="input-group-view">
        <div className="dropdown-group-view">
          <Select
            className="custom-select responsive-custom-select-2"
            value={subjectId || undefined}
            onChange={handleSubjectChange}
            placeholder="เลือกรหัสวิชา..."
            // style={{ width: 320, height: 35 }}
          >
            {subjectList.map((subject) => (
              <Option key={subject.Subject_id} value={subject.Subject_id}>
                {subject.Subject_id} ({subject.Subject_name})
              </Option>
            ))}
          </Select>
        </div>

        <div className="button-group-view">
          <Button
            variant="primary"
            size="view-btt"
            onClick={handleDownloadPDF}
            style={{ display: "flex", alignItems: "center" }}
          >
            <DownloadIcon style={{ fontSize: "18px", marginRight: " 10px" }} />
            Download all
          </Button>
          <Button
            variant="danger"
            size="view-btt"
            onClick={handleDelete}
            style={{ display: "flex", alignItems: "center" }}
          >
            <DeleteIcon style={{ fontSize: "18px", marginRight: "10px" }} />
            Delete all
          </Button>
        </div>
      </div>

      <Table
        dataSource={imageList}
        columns={columns}
        rowKey="Page_id"
        pagination={{ pageSize: 5 }}
        className="custom-table"
      />

      {isModalVisible && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",

            overflow: "auto",
          }}
          onClick={handleCloseModal}
        >
          {selectedImage ? (
            <div
              style={{
                position: "relative",
                textAlign: "center",
              }}
            >
              {/* รูปภาพ */}
              <img
                src={selectedImage}
                alt="Full Size"
                style={{
                  maxWidth: "80vw",
                  maxHeight: "80vh",
                  transform: `scale(${scale})`,
                  transition: "transform 0.3s ease-in-out",
                  objectFit: "contain",
                  transformOrigin: "center",
                }}
              />

              {/* ปุ่มควบคุมการซูม */}
              <div
                style={{
                  position: "absolute",
                  bottom: "20px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: "10px",
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // หยุดการแพร่กระจายของเหตุการณ์
                    decreaseZoom();
                  }}
                  style={{
                    background: "white",
                    border: "1px solid #ccc",
                    borderRadius: "50%",
                    width: "40px",
                    height: "40px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <MinusOutlined />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // หยุดการแพร่กระจายของเหตุการณ์
                    increaseZoom();
                  }}
                  style={{
                    background: "white",
                    border: "1px solid #ccc",
                    borderRadius: "50%",
                    width: "40px",
                    height: "40px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <PlusOutlined />
                </button>
              </div>
            </div>
          ) : (
            <p style={{ color: "white" }}>Loading image...</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ViewExamsheet;
