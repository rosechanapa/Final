import React, { useState, useEffect } from "react";
import "../css/recheck.css";
import { Card, Select, Col, Row } from "antd";
import axios from "axios";

const { Option } = Select;
const Recheck = () => {
  const [subjectId, setSubjectId] = useState("");
  const [subjectList, setSubjectList] = useState([]);
  const [pageList, setPageList] = useState([]);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:5000/get_subjects");
        const subjects = response.data;
        setSubjectList(subjects);

        // ตั้งค่า subjectId เป็น Subject_id แรกที่เจอในรายการ
        if (subjects.length > 0) {
          const firstSubjectId = subjects[0].Subject_id;
          setSubjectId(firstSubjectId);
        }
      } catch (error) {
        console.error("Error fetching subjects:", error);
      }
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    const fetchPages = async () => {
      if (subjectId) {
        try {
          const response = await fetch(
            `http://127.0.0.1:5000/get_pages/${subjectId}`
          );
          const data = await response.json();
          setPageList(data);
        } catch (error) {
          console.error("Error fetching pages:", error);
        }
      } else {
        setPageList([]); // เคลียร์ dropdown เมื่อไม่ได้เลือก subjectId
      }
    };

    fetchPages();
  }, [subjectId]);

  return (
    <div>
      <h1 className="Title">Recheck</h1>
      <div className="input-group-std">
        <div className="dropdown-group">
          <label className="label-std">วิชา: </label>
          <Select
            className="custom-select-std"
            placeholder="เลือกวิชา..."
            style={{ width: 300, height: 40 }}
          >
            {subjectList.map((subject) => (
              <Option key={subject.Subject_id} value={subject.Subject_id}>
                {subject.Subject_id} ({subject.Subject_name})
              </Option>
            ))}
          </Select>
        </div>

        <div className="dropdown-group">
          <label className="label-std">เลขหน้า: </label>
          <Select
            className="custom-select-std"
            placeholder="เลือกเลขหน้า..."
            style={{ width: 250, height: 40 }}
          >
            {pageList.map((page) => (
              <Option key={page.page_no} value={page.page_no}>
                หน้า {page.page_no}
              </Option>
            ))}
          </Select>
        </div>
      </div>
      <Card
        className="card-edit"
        style={{
          width: "100%",
          height: "900px",
          margin: "0 auto",
          padding: "20px",
        }}
      >
        <Row gutter={[16, 16]} style={{ height: "100%" }}>
          {/* ด้านซ้าย */}
          <Col
            span={16}
            style={{ borderRight: "1px solid #ccc", height: "100%" }}
          >
            <div
              style={{
                padding: "20px",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <h2>เนื้อหาด้านซ้าย</h2>
              <p>ใส่เนื้อหาด้านซ้าย เช่น ข้อมูลหลักหรือ UI ที่สำคัญ</p>
            </div>
          </Col>

          {/* ด้านขวา */}
          <Col span={8} style={{ height: "100%" }}>
            <div
              style={{
                padding: "20px",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <h2>เนื้อหาด้านขวา</h2>
              <p>ใส่เนื้อหาด้านขวา เช่น ข้อมูลเสริมหรือเมนู</p>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Recheck;
