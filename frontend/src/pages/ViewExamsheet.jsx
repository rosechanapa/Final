import "../css/viewExamsheet.css";
//import { useSearchParams } from "react-router-dom";
import { Table, Select, message } from "antd";
import React, { useState, useEffect } from "react";
import axios from "axios";
import Button from "../components/Button";
import DownloadIcon from "@mui/icons-material/Download";

const { Option } = Select;

const ViewExamsheet = () => {
  //const [searchParams] = useSearchParams();
  const [subjectList, setSubjectList] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [imageList, setImageList] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/get_subjects");
        const data = await response.json();
        console.log("Subjects Data:", data);
        setSubjectList(data);
  
        // ตั้งค่า subjectId เป็น Subject_id แรกที่เจอในตาราง
        if (data.length > 0) {
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
    window.location.href = `http://127.0.0.1:5000/download_image/${subjectId}/${imageId}`;
  };
 
  const columns = [
    {
      title: "ภาพที่",
      dataIndex: "page_no",
      key: "page_no",
      render: (text) => `ภาพที่ ${text}`,
    },
    {
      title: "ตัวอย่างภาพ",
      dataIndex: "image_path",
      key: "image_path",
      render: (text) => (
        <img
          src={`http://127.0.0.1:5000/get_image_subject/${subjectId}/${text.split("/").pop()}`}
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
            onClick={() => handleDownload(record.page_no)}
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