import React, { useState, useEffect } from "react";
import "../css/analyze.css";
import { Card, Select, message, Col, Row } from "antd";
// import EditIcon from "@mui/icons-material/Edit";
// import SaveIcon from "@mui/icons-material/Save";
// import axios from "axios";
import Button from "../components/Button";

const { Option } = Select;
const Analyze = () => {
  const [students, setStudents] = useState([]); // เก็บข้อมูลนักศึกษา
  const [subjectId, setSubjectId] = useState("");
  const [section, setSection] = useState("");
  const [subjectList, setSubjectList] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [uploadedFileList, setUploadedFileList] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [sections, setSections] = useState([]);
  const [originalStudents, setOriginalStudents] = useState([]);
  const [searchValue, setSearchValue] = useState("");

  const handleSubjectChange = (value) => {
    setSubjectId(value);
    setSection("");
    setStudents([]);
    fetchSections(value);
  };

  const handleSectionChange = (value) => {
    setSection(value);
  };
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/get_subjects");
        const data = await response.json();
        setSubjectList(data);

        // ตั้งค่า subjectId เป็น Subject_id แรกที่เจอ
        if (data.length > 0) {
          const firstSubjectId = data[0].Subject_id;
          setSubjectId(firstSubjectId);

          // ดึงข้อมูล sections และ students สำหรับ Subject_id แรก
          fetchSections(firstSubjectId);
        }
      } catch (error) {
        console.error("Error fetching subjects:", error);
      }
    };

    fetchSubjects();
  }, []);

  const fetchSections = async (subjectId) => {
    if (!subjectId) {
      setSections([]); // รีเซ็ต sections
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/get_sections?subjectId=${subjectId}`
      );
      if (response.ok) {
        const data = await response.json();
        setSections(data);
      } else {
        const errorData = await response.json();
        message.error(errorData.error);
        setSections([]); // รีเซ็ต sections
      }
    } catch (error) {
      console.error("Error fetching sections:", error);
      message.error("Failed to fetch sections.");
      setSections([]); // รีเซ็ต sections
    }
  };

  return (
    <div>
      <h1 className="Title">ภาพรวมคะแนน</h1>

      <div className="input-group-std">
        <div className="dropdown-group">
          <label className="label-std">วิชา: </label>
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
        <div className="dropdown-group">
          <label className="label-std">ตอนเรียน: </label>
          <Select
            className="custom-select"
            value={section || undefined}
            onChange={handleSectionChange}
            placeholder="เลือกตอนเรียน..."
            style={{ width: 250, height: 40 }}
          >
            <Option value="">ทุกตอนเรียน</Option>
            {sections.map((sec) => (
              <Option key={sec} value={sec}>
                ตอนเรียน {sec}
              </Option>
            ))}
          </Select>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginTop: "30px" }}>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card
            title={
              <span style={{ fontSize: "18px", fontWeight: "bold" }}>310</span>
            }
            bordered={true}
            style={{ textAlign: "center", backgroundColor: "#f9f9f9" }}
          >
            จำนวนทั้งหมด
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card
            title={
              <span style={{ fontSize: "18px", fontWeight: "bold" }}>
                57 / 60
              </span>
            }
            bordered={true}
            style={{ textAlign: "center", backgroundColor: "#f9f9f9" }}
          >
            คะแนนที่มากที่สุด
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card
            title={
              <span style={{ fontSize: "18px", fontWeight: "bold" }}>
                25.6 / 60
              </span>
            }
            bordered={true}
            style={{ textAlign: "center", backgroundColor: "#f9f9f9" }}
          >
            คะแนนเฉลี่ย
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card
            title={
              <span style={{ fontSize: "18px", fontWeight: "bold" }}>
                13 / 60
              </span>
            }
            bordered={true}
            style={{ textAlign: "center", backgroundColor: "#f9f9f9" }}
          >
            คะแนนที่น้อยที่สุด
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Analyze;
