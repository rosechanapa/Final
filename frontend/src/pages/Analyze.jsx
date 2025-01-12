import React, { useState, useEffect } from "react";
import "../css/analyze.css";
import { Card, Select, message, Col, Row, Table, Typography } from "antd";
// import EditIcon from "@mui/icons-material/Edit";
// import SaveIcon from "@mui/icons-material/Save";
// import axios from "axios";
import SDGraph from "../components/SDGraph";
import BellCurve from "../components/BellCurve";
import studentIcon from "../img/student.png";
// import cautionBlue from "../img/cautionblue.png";
import cautionRed from "../img/cautionred.png";
import bestScore from "../img/bestscore.png";
import announcement from "../img/announcement.png";

const { Title } = Typography;
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
    updateTotals(value, "");
  };

  const handleSectionChange = (value) => {
    setSection(value);
    fetchStudentCount(subjectId, value || null); // เรียก fetchStudentCount
    updateTotals(subjectId, value); // อัปเดต Total เมื่อเปลี่ยน Section
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
          updateTotals(firstSubjectId, ""); // อัปเดต Total
          fetchScoresSummary(firstSubjectId, ""); // ดึงข้อมูลคะแนน
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

  const updateTotals = async (subjectId, section) => {
    try {
      const response = await fetch("http://127.0.0.1:5000/update_totals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_id: subjectId, section }),
      });

      const data = await response.json();
      if (!data.success) {
        console.error("Error updating totals:", data.message);
      }
    } catch (error) {
      console.error("Error updating totals:", error);
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

  const fetchScoresSummary = async (subjectId, section) => {
    try {
      const url = section
        ? `http://127.0.0.1:5000/get_scores_summary?subject_id=${subjectId}&section=${section}`
        : `http://127.0.0.1:5000/get_scores_summary?subject_id=${subjectId}`;

      console.log("Fetching from URL:", url);

      const response = await fetch(url);
      const data = await response.json();
      console.log("API Response:", data); // ตรวจสอบผลลัพธ์

      if (data.success) {
        setScoresSummary(data.scores_summary); // บันทึกคะแนนใน state
      } else {
        console.error("API Error:", data.message);
        setScoresSummary({ maxScore: 0, minScore: 0, avgScore: 0 });
      }
    } catch (error) {
      console.error("Error fetching scores summary:", error);
      setScoresSummary({ maxScore: 0, minScore: 0, avgScore: 0 });
    }
  };

  useEffect(() => {
    fetchStudentCount(subjectId, section);
    updateTotals(subjectId, section);
    fetchScoresSummary(subjectId, section);
    console.log("Fetching Scores Summary for:", subjectId, section);
  }, [subjectId, section]);

  const columns = [
    {
      title: "ข้อที่",
      dataIndex: "question",
      key: "question",
      align: "center",
    },
    {
      title: "จำนวนนักศึกษาที่ตอบได้",
      dataIndex: "students",
      key: "students",
      align: "center",
    },
  ];

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
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card
            bordered={true}
            style={{ height: "150px" }}
            className="custom-card-dashboard"
          >
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
                  <span className="dashboard-sub-text">จำนวนนักศึกษา</span>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6} lg={6}>
          <Card
            bordered={true}
            style={{ height: "150px" }}
            className="custom-card-dashboard"
          >
            <Row align="middle">
              {/* Image */}
              <Col>
                <img src={bestScore} alt="icon" className="dashboard-icon" />
              </Col>
              {/* Text */}
              <Col flex="auto">
                <div className="head-sub-font-dashboard">
                  <span className="dashboard-head-text">
                    {scoresSummary.max_score || 0} / 60
                  </span>
                  <span className="dashboard-sub-text">คะแนนที่มากที่สุด</span>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6} lg={6}>
          <Card
            bordered={true}
            style={{ height: "150px" }}
            className="custom-card-dashboard"
          >
            <Row align="middle">
              {/* Image */}
              <Col>
                <img src={announcement} alt="icon" className="dashboard-icon" />
              </Col>
              {/* Text */}
              <Col flex="auto">
                <div className="head-sub-font-dashboard">
                  <span className="dashboard-head-text">
                    {scoresSummary.avg_score || 0} / 60
                  </span>
                  <span className="dashboard-sub-text">คะแนนเฉลี่ย</span>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6} lg={6}>
          <Card
            bordered={true}
            style={{ height: "150px" }}
            className="custom-card-dashboard"
          >
            <Row align="middle">
              {/* Image */}
              <Col>
                <img src={cautionRed} alt="icon" className="dashboard-icon" />
              </Col>
              {/* Text */}
              <Col flex="auto">
                <div className="head-sub-font-dashboard">
                  <span className="dashboard-head-text">
                    {scoresSummary.max_score || 0} / 60
                  </span>

                  <span className="dashboard-sub-text">คะแนนที่น้อยที่สุด</span>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: "40px" }}>
        {/* Card ซ้าย */}
        <Col xs={24} sm={12} md={12} lg={12}>
          <Card
            style={{ height: "auto" }}
            className="custom-card-dashboard"
            bordered={true}
          >
            {section === "" ? (
              <SDGraph subjectId={subjectId} />
            ) : (
              <BellCurve subjectId={subjectId} section={section} />
            )}
          </Card>
        </Col>

        {/* Card ขวา */}
        <Col xs={24} sm={12} md={12} lg={12}>
          <Card
            style={{ height: "auto" }}
            className="custom-card-dashboard"
            bordered={true}
          >
            <Title
              level={3}
              style={{ textAlign: "center", marginBottom: "20px" }}
            >
              ตารางสรุป
            </Title>
            <Row gutter={[16, 16]}>
              {/* Table 1 */}
              <Col xs={24} sm={12} md={12} lg={12}>
                <Title level={4} style={{ textAlign: "center" }}>
                  ข้อที่ตอบได้มากที่สุด
                </Title>
                <Table
                  columns={columns}
                  // dataSource={data}
                  pagination={false}
                  bordered
                />
              </Col>
              {/* Table 2 */}
              <Col xs={24} sm={12} md={12} lg={12}>
                <Title level={4} style={{ textAlign: "center" }}>
                  ข้อที่ตอบได้น้อยที่สุด
                </Title>
                <Table
                  columns={columns}
                  // dataSource={data}
                  pagination={false}
                  bordered
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Analyze;
