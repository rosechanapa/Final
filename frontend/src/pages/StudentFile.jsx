import React, { useState, useEffect } from "react";
import "../css/studentfile.css";
import { Card } from "antd";
import { Input, Select, Button } from "antd";
import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";

const { Option } = Select;
const StudentFile = () => {
  const [subjectList, setSubjectList] = useState([]); // เก็บรายการวิชาจาก database
  const [selectedSubject, setSelectedSubject] = useState(""); // วิชาที่เลือก
  const [searchTerm, setSearchTerm] = useState(""); // ค้นหานักศึกษา

  // ดึงข้อมูลวิชาจาก Database
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("http://localhost:5000/get_subjects"); // แก้เป็น API ของคุณ
        const data = await response.json();
        setSubjectList(data); // อัปเดต State
      } catch (error) {
        console.error("Error fetching subjects:", error);
      }
    };
    fetchSubjects();
  }, []);

  return (
    <div>
      <h1 className="Title">Student</h1>
      <div className="header-container">
        <Select
          placeholder="เลือกวิชา..."
          style={{ width: 340, height: 40 }}
          value={selectedSubject}
          onChange={(value) => setSelectedSubject(value)}
        >
          {subjectList.map((subject) => (
            <Option key={subject.Subject_id} value={subject.Subject_name}>
              {subject.Subject_name}
            </Option>
          ))}
        </Select>

        {/* ช่อง Search, Add Student และ Export CSV */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {/* ช่อง Search */}
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 200 }}
          />

          {/* ปุ่ม Add Student */}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ marginLeft: "10px" }}
          >
            ADD Student
          </Button>

          {/* ปุ่ม Export CSV */}
          <Button
            type="default"
            icon={<DownloadOutlined />}
            style={{ marginLeft: "10px" }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <Card
        title="นักศึกษาทั้งหมด"
        className="card-edit"
        style={{
          width: "100%",
          height: 600,
          margin: "0 auto",
        }}
      >
        <p>Card content</p>
      </Card>
    </div>
  );
};

export default StudentFile;
