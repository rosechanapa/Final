import React, { useState, useEffect } from "react";
import "../css/analyze.css";
import { Card, Select, message, Col, Row, Table } from "antd";
import axios from "axios";
import ScoreChart from "../components/ScoreChart";
import minScore from "../img/warning.png";
import bestScore from "../img/medal.png";
import avgScore from "../img/milometer.png";
import graduated from "../img/graduated.png";

const { Option } = Select;
const Analyze = () => {
  const [subjectId, setSubjectId] = useState("");
  const [section, setSection] = useState("");
  const [subjectList, setSubjectList] = useState([]);
  const [studentCount, setStudentCount] = useState(0);
  const [sections, setSections] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  const [scoresSummary, setScoresSummary] = useState({
    maxScore: 0,
    minScore: 0,
    avgScore: 0,
  });
  const [mostCorrect, setMostCorrect] = useState([]); // ข้อมูลข้อที่ตอบถูกเยอะที่สุด
  const [leastCorrect, setLeastCorrect] = useState([]); // ข้อมูลข้อที่ตอบผิดเยอะที่สุด
  const [loadingSummary, setLoadingSummary] = useState(true); // สถานะโหลดสำหรับสรุปตาราง

  const handleSubjectChange = (value) => {
    setSubjectId(value);
    setSection("");
    fetchSections(value);
    updateTotals(value, "");
    fetchSummary(value, ""); // ดึงข้อมูลสรุปข้อสอบใหม่เมื่อเปลี่ยน Subject
    fetchScoresSummary(value, ""); // อัปเดตข้อมูลคะแนนใหม่
  };

  const handleSectionChange = (value) => {
    setSection(value);
    fetchStudentCount(subjectId, value || null); // เรียก fetchStudentCount
    updateTotals(subjectId, value); // อัปเดต Total เมื่อเปลี่ยน Section
    fetchSummary(subjectId, value); // ดึงข้อมูลสรุปข้อสอบใหม่เมื่อเปลี่ยน Section
    fetchScoresSummary(subjectId, value); // อัปเดตข้อมูลคะแนนใหม่
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
          fetchSummary(firstSubjectId, ""); // ดึงข้อมูลสรุปข้อสอบเริ่มต้น
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

  const fetchSummary = async (subjectId) => {
    setLoadingSummary(true);
    try {
      const url = `http://127.0.0.1:5000/get_summary?subject_id=${subjectId}`;
      const response = await axios.get(url);

      if (response.status === 200) {
        setMostCorrect(
          response.data.top_max_no.map((item, index) => ({
            key: index,
            question_no: item.no,
            correct_count: item.correct_count,
          }))
        );

        setLeastCorrect(
          response.data.top_low_no.map((item, index) => ({
            key: index,
            question_no: item.no,
            correct_count: item.correct_count,
          }))
        );
      } else {
        console.error("Error fetching summary:", response.data.error);
      }
    } catch (error) {
      console.error("Error fetching summary:", error);
    } finally {
      setLoadingSummary(false);
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

  const fetchTotalScore = async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/get_total_score?subject_id=${subjectId}`
      );
      const data = await response.json();
      if (data.success) {
        setTotalScore(data.total_score);
      } else {
        console.error("Failed to fetch total score:", data.message);
      }
    } catch (error) {
      console.error("Error fetching total score:", error);
    }
  };

  useEffect(() => {
    if (subjectId) {
      fetchTotalScore();
    }
  }, [subjectId]);

  const columns = [
    {
      title: "ข้อที่",
      dataIndex: "question_no",
      key: "question_no",
      align: "center",
    },
    {
      title: "จำนวนนักศึกษา",
      dataIndex: "correct_count",
      key: "correct_count",
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
            className="custom-select responsive-custom-select-2"
            value={subjectId || undefined}
            onChange={handleSubjectChange}
            placeholder="เลือกรหัสวิชา..."
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
            className="custom-select responsive-custom-select-2"
            value={section || ""}
            onChange={handleSectionChange}
            placeholder="เลือกตอนเรียน..."
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
            style={{ height: "auto" }}
            className="custom-card-dashboard"
          >
            <Row align="middle">
              {/* Image */}
              <Col>
                <img src={graduated} alt="icon" className="dashboard-icon" />
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
            style={{ height: "auto" }}
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
                    {scoresSummary.max_score || 0} / {totalScore}
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
            style={{ height: "auto" }}
            className="custom-card-dashboard"
          >
            <Row align="middle">
              {/* Image */}
              <Col>
                <img src={avgScore} alt="icon" className="dashboard-icon" />
              </Col>
              {/* Text */}
              <Col flex="auto">
                <div className="head-sub-font-dashboard">
                  <span className="dashboard-head-text">
                    {scoresSummary.avg_score || 0} / {totalScore}
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
            style={{ height: "auto" }}
            className="custom-card-dashboard"
          >
            <Row align="middle">
              {/* Image */}
              <Col>
                <img src={minScore} alt="icon" className="dashboard-icon" />
              </Col>
              {/* Text */}
              <Col flex="auto">
                <div className="head-sub-font-dashboard">
                  <span className="dashboard-head-text">
                    {scoresSummary.min_score || 0} / {totalScore}
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
            style={{
              alignItems: "center",
              justifyContent: "center",
            }}
            className="custom-card-dashboard"
            bordered={true}
          >
            {section === "" ? (
              <ScoreChart subjectId={subjectId} />
            ) : (
              <ScoreChart subjectId={subjectId} section={section} />
            )}
          </Card>
        </Col>

        {/* Card ขวา */}
        <Col xs={24} sm={12} md={12} lg={12}>
          <Card className="custom-card-dashboard" bordered={true}>
            <h1 className="table-summarize-headtext">ตารางสรุป</h1>
            <Row gutter={[16, 16]}>
              {/* Table 1 */}
              <Col xs={24} sm={12} md={12} lg={12}>
                <h1 className="table-summarize-text">ข้อที่ตอบได้มากที่สุด</h1>
                <Table
                  columns={columns}
                  dataSource={mostCorrect}
                  loading={loadingSummary}
                  pagination={false}
                  bordered
                  className="custom-table"
                  style={{ marginTop: "15px" }}
                  rowKey="question_no"
                />
              </Col>
              {/* Table 2 */}
              <Col xs={24} sm={12} md={12} lg={12}>
                <h1 className="table-summarize-text">ข้อที่ตอบได้น้อยที่สุด</h1>
                <Table
                  columns={columns}
                  dataSource={leastCorrect}
                  loading={loadingSummary}
                  pagination={false}
                  bordered
                  className="custom-table"
                  style={{ marginTop: "15px" }}
                  rowKey="question_no"
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