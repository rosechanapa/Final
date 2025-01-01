import "../css/viewExamsheet.css";
import { Table, Select, Popconfirm, message } from "antd";
import React, { useState, useEffect } from "react";
import axios from "axios";
import Button from "../components/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";

const { Option } = Select;

const ViewExamsheet = () => {
  const [subjectList, setSubjectList] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [imageList, setImageList] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleSubjectChange = (value) => {
    setSubjectId(value);
  };
  const handleImageClick = (text) => {
    const imageUrl = `http://127.0.0.1:5000/get_image_subject${text}`;
    console.log("Selected Image URL:", imageUrl); // Debugging URL
    setSelectedImage(imageUrl);
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
      if (!subjectId) {
        console.error("Subject ID is empty");
        return;
      }
      console.log(`Fetching images for Subject ID: ${subjectId}`); // ตรวจสอบค่า
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/get_image/${subjectId}`
        );
        if (response.data.status === "success") {
          setImageList(response.data.data);
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

  const handleDelete = async (imageId) => {
    try {
      const response = await axios.delete(
        `http://127.0.0.1:5000/delete_image/${subjectId}/${imageId}`
      );
      if (response.data.status === "success") {
        message.success("Image deleted successfully");
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error deleting image:", error);
    }
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
          src={`http://127.0.0.1:5000/get_image_subject${text}`}
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
        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          <Button
            size="edit"
            varian="primary"
            type="link"
            onClick={() => handleDownload(record.image_id)}
          >
            <DownloadIcon />
          </Button>
          <Popconfirm
            title="คุณต้องการลบภาพนี้หรือไม่?"
            onConfirm={() => handleDelete(record.image_id)}
            okText="ใช่"
            cancelText="ไม่"
          >
            <Button variant="danger" size="edit">
              <DeleteIcon />
            </Button>
          </Popconfirm>
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
          }}
          onClick={handleCloseModal}
        >
          <img
            src={selectedImage}
            alt="Selected"
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ViewExamsheet;
