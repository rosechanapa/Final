import "../css/viewExamsheet.css";
import { useSearchParams } from "react-router-dom";
import { Table, Select, Modal, message } from "antd";
import React, { useState, useEffect } from "react";
import axios from "axios";
import Button from "../components/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";

const { Option } = Select;

const ViewExamsheet = () => {
  const [searchParams] = useSearchParams();
  const [subjectList, setSubjectList] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [imageList, setImageList] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    const initialSubjectId = searchParams.get("subjectId");
    if (initialSubjectId) {
      setSubjectId(initialSubjectId); // ตั้งค่า subjectId เริ่มต้น
    }
  }, [searchParams]);

  const handleSubjectChange = (value) => {
    setSubjectId(value);
  };

  const handleImageClick = (imagePath) => {
    const filename = imagePath.split("/").pop(); // ดึงเฉพาะชื่อไฟล์ เช่น "1.jpg"
    const fullImageUrl = `http://127.0.0.1:5000/get_image_subject/${subjectId}/${filename}`;
    console.log("Generated Full Image URL:", fullImageUrl); // Debugging
    setSelectedImage(fullImageUrl);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setSelectedImage(null);
    setIsModalVisible(false);
  };

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/get_subjects");
        const data = await response.json();
        console.log("Subjects Data:", data);
        setSubjectList(data);
      } catch (error) {
        console.error("Error fetching subjects:", error);
      }
    };

    fetchSubjects();
  }, []);

  useEffect(() => {
    const fetchImages = async () => {
      if (!subjectId) return;
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/get_image/${subjectId}`
        );
        if (response.data.status === "success") {
          setImageList(response.data.data); // เก็บข้อมูล image list
        } else {
          message.error(response.data.message);
        }
      } catch (error) {
        console.error("Error fetching images:", error);
      }
    };

    fetchImages();
  }, [subjectId]);

  const handleDownload = (imageId) => {
    window.location.href = `http://127.0.0.1:5000/download_image/${subjectId}/${imageId}`;
  };

  const handleDelete = (imageId) => {
    Modal.confirm({
      title: "คุณต้องการลบภาพนี้หรือไม่?",
      content: "การลบภาพนี้จะลบไฟล์ภาพและข้อมูลที่เกี่ยวข้องทั้งหมด",
      okText: "ใช่",
      cancelText: "ไม่",
      onOk: async () => {
        try {
          const response = await axios.delete(
            `http://127.0.0.1:5000/delete_image/${subjectId}/${imageId}`
          );

          if (response.data.status === "success") {
            message.success("ลบไฟล์ภาพและข้อมูลที่เกี่ยวข้องเรียบร้อยแล้ว");

            // อัปเดตรายการภาพใน Frontend หลังจากลบสำเร็จ
            setImageList((prevList) =>
              prevList.filter((img) => img.image_id !== imageId)
            );
          } else {
            message.error(response.data.message);
          }
        } catch (error) {
          console.error("Error deleting image:", error);
          message.error("เกิดข้อผิดพลาดในการลบไฟล์ภาพ");
        }
      },
    });
  };

  const columns = [
    {
      title: "ภาพที่",
      dataIndex: "image_id",
      key: "image_id",
      render: (text) => `${text}`,
    },
    {
      title: "ตัวอย่างภาพ",
      dataIndex: "image_path",
      key: "image_path",
      render: (text) => (
        <img
          // src={`http://127.0.0.1:5000/get_image_subject/${subjectId}/${text}`}
          // src={`http://127.0.0.1:5000/get_image_subject${text}`}
          src={`http://127.0.0.1:5000/get_image_subject/${subjectId}/${text
            .split("/")
            .pop()}`}
          alt="Example"
          style={{ width: "100px", height: "auto", cursor: "pointer" }}
          onClick={() => handleImageClick(text)}
        />
      ),
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            size="edit"
            varian="primary"
            type="link"
            onClick={() => handleDownload(record.image_id)}
          >
            <DownloadIcon />
          </Button>
          <Button
            variant="danger"
            size="edit"
            onClick={() => handleDelete(record.image_id)}
          >
            <DeleteIcon />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h1 className="Title">กระดาษคำตอบที่สร้าง</h1>
      <div className="input-group-std">
        <div className="dropdown-group">
          <Select
            className="custom-select-std"
            value={subjectId || undefined}
            onChange={handleSubjectChange}
            placeholder="เลือกวิชา..."
            style={{ width: 340, height: 40 }}
          >
            {subjectList.map((subject) => (
              <Option key={subject.Subject_id} value={subject.Subject_id}>
                {subject.Subject_id} ({subject.Subject_name})
              </Option>
            ))}
          </Select>
        </div>
      </div>
      <Table
        dataSource={imageList}
        columns={columns}
        rowKey="image_id"
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
            zIndex: 1000,
          }}
          onClick={handleCloseModal}
        >
          {console.log("Selected Image in Modal:", selectedImage)}
          {selectedImage ? (
            <img
              src={selectedImage}
              alt="Full Size"
              style={{
                maxWidth: "90%",
                maxHeight: "90%",
              }}
            />
          ) : (
            <p style={{ color: "white" }}>Loading image...</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ViewExamsheet;
