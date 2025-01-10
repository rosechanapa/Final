import React, { useState, useEffect } from "react";
import "../css/analyze.css";
import { Card, Select, message, Col, Row } from "antd";
// import EditIcon from "@mui/icons-material/Edit";
// import SaveIcon from "@mui/icons-material/Save";
// import axios from "axios";

import studentIcon from "../img/student.png";
// import cautionBlue from "../img/cautionblue.png";
import cautionRed from "../img/cautionred.png";
import bestScore from "../img/bestscore.png";
import announcement from "../img/announcement.png";

const { Option } = Select;
const Analyze = () => {
  const [students, setStudents] = useState([]); // เก็บข้อมูลนักศึกษา
  const [subjectId, setSubjectId] = useState("");
  const [section, setSection] = useState("");
  const [subjectList, setSubjectList] = useState([]);
  const [studentCount, setStudentCount] = useState(0);
  const [sections, setSections] = useState([]);
  const [scoresSummary, setScoresSummary] = useState({
    maxScore: 0,
    minScore: 0,
    avgScore: 0,
  });

  const handleSubjectChange = (value) => {
    setSubjectId(value);
    setSection("");
    setStudents([]);
    fetchSections(value);
  };

  const handleSectionChange = (value) => {
    setSection(value);
    fetchStudentCount(subjectId, value || null); // เรียก fetchStudentCount
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
          fetchStudentCount(firstSubjectId, "");
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

  const fetchStudentCount = async (subjectId, section) => {
    const url = section
      ? `http://127.0.0.1:5000/get_student_count?subject_id=${subjectId}&section=${section}`
      : `http://127.0.0.1:5000/get_student_count?subject_id=${subjectId}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      console.log("Student Count Response:", data); // Debug
      if (data.success) {
        setStudentCount(data.student_count);
      } else {
        setStudentCount(0);
      }
    } catch (error) {
      console.error("Error fetching student count:", error);
      setStudentCount(0);
    }
  };

  useEffect(() => {
    fetchStudentCount(subjectId, section);
  }, [subjectId, section]);

  const fetchScoresSummary = async (subjectId, section) => {
    try {
      const url = section
        ? `http://127.0.0.1:5000/get_scores_summary?subject_id=${subjectId}&section=${section}`
        : `http://127.0.0.1:5000/get_scores_summary?subject_id=${subjectId}`;

      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setScoresSummary(data.scores_summary); // บันทึกคะแนนใน state
      } else {
        setScoresSummary({ maxScore: 0, minScore: 0, avgScore: 0 });
      }
    } catch (error) {
      console.error("Error fetching scores summary:", error);
      setScoresSummary({ maxScore: 0, minScore: 0, avgScore: 0 });
    }
  };
  useEffect(() => {
    fetchScoresSummary(subjectId, section);
  }, [subjectId, section]);

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
            value={section || ""}
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

      <Row gutter={[16, 16]} style={{ marginTop: "50px" }}>
        <Col xs={24} sm={12} md={12} lg={6}>
          <Card bordered={true} className="custom-card-dashboard">
            <Row align="middle">
              {/* Image */}
              <Col>
                <img src={studentIcon} alt="icon" className="dashboard-icon" />
              </Col>
              {/* Text */}
              <Col flex="auto">
                <div className="head-sub-font-dashboard">
                  <span className="dashboard-head-text">
                    {" "}
                    {studentCount || 0}
                  </span>
                  <span className="dashboard-sub-text">
                    จำนวนนักศึกษาทั้งหมด
                  </span>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={12} lg={6}>
          <Card bordered={true} className="custom-card-dashboard">
            <Row align="middle">
              {/* Image */}
              <Col>
                <img src={bestScore} alt="icon" className="dashboard-icon" />
              </Col>
              {/* Text */}
              <Col flex="auto">
                <div className="head-sub-font-dashboard">
                  <span className="dashboard-head-text">
                    {scoresSummary.maxScore || 0} / 60
                  </span>
                  <span className="dashboard-sub-text">คะแนนที่มากที่สุด</span>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={12} lg={6}>
          <Card bordered={true} className="custom-card-dashboard">
            <Row align="middle">
              {/* Image */}
              <Col>
                <img src={announcement} alt="icon" className="dashboard-icon" />
              </Col>
              {/* Text */}
              <Col flex="auto">
                <div className="head-sub-font-dashboard">
                  <span className="dashboard-head-text">
                    {scoresSummary.avgScore || 0} / 60
                  </span>
                  <span className="dashboard-sub-text">คะแนนเฉลี่ย</span>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={12} lg={6}>
          <Card bordered={true} className="custom-card-dashboard">
            <Row align="middle">
              {/* Image */}
              <Col>
                <img src={cautionRed} alt="icon" className="dashboard-icon" />
              </Col>
              {/* Text */}
              <Col flex="auto">
                <div className="head-sub-font-dashboard">
                  <span className="dashboard-head-text">
                    {scoresSummary.minScore || 0} / 60
                  </span>

                  <span className="dashboard-sub-text">คะแนนที่น้อยที่สุด</span>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Analyze;
