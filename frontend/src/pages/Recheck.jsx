import React, { useState, useEffect } from "react";
import "../css/recheck.css";
import { Card, Select, Col, Row, Table } from "antd";
import axios from "axios";
import Button from "../components/Button";
import { RightOutlined, LeftOutlined } from "@ant-design/icons";

const { Option } = Select;
const Recheck = () => {
  const [subjectId, setSubjectId] = useState("");
  const [subjectList, setSubjectList] = useState([]);
  const [pageList, setPageList] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [sheetList, setSheetList] = useState([]);
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [pageNo, setPageNo] = useState(null);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:5000/get_subjects");
        const subjects = response.data;
        setSubjectList(subjects);

        console.log("Subjects fetched:", subjects);
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
          console.log("Fetching pages for Subject ID:", subjectId); // Debug
          const response = await axios.get(
            `http://127.0.0.1:5000/get_pages/${subjectId}`
          );
          setPageList(response.data);
        } catch (error) {
          console.error("Error fetching pages:", error);
        }
      } else {
        setPageList([]);
      }
    };

    fetchPages();
  }, [subjectId]);

  useEffect(() => {
    const fetchImages = async () => {
      if (!subjectId || !pageNo) {
        setImages([]); // รีเซ็ต images ถ้าไม่มี subjectId หรือ pageNo
        return;
      }

      try {
        const response = await axios.get(
          "http://127.0.0.1:5000/get_sheets_page",
          {
            params: {
              subject_id: subjectId,
              page_no: pageNo,
            },
          }
        );

        if (response.data.success) {
          setImages(response.data.images); // ตั้งค่าภาพใหม่
          setCurrentImageIndex(0); // รีเซ็ต index ของภาพปัจจุบัน
        } else {
          console.error(response.data.message);
          setImages([]); // รีเซ็ต images ถ้าไม่พบข้อมูล
        }
      } catch (error) {
        console.error("Error fetching images:", error);
        setImages([]); // รีเซ็ต images เมื่อเกิดข้อผิดพลาด
      }
    };

    fetchImages();
  }, [subjectId, pageNo]); // ผูกกับ subjectId และ pageNo

  useEffect(() => {
    const fetchAnswers = async () => {
      if (subjectId) {
        try {
          const response = await axios.get(
            `http://127.0.0.1:5000/get_answers/${subjectId}`
          );
          setAnswers(response.data);
        } catch (error) {
          console.error("Error fetching answers:", error);
        }
      }
    };
    fetchAnswers();
  }, [subjectId]);

  const columns = [
    {
      title: "ข้อที่",
      dataIndex: "answer_id",
      key: "answer_id",
    },
    {
      title: "คำตอบ",
      dataIndex: "modelread",
      key: "modelread",
    },
    {
      title: "เฉลย",
      dataIndex: "label",
      key: "label",
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <>
          <Button type="primary" style={{ marginRight: 10 }}>
            Edit
          </Button>
          <Button type="danger">Delete</Button>
        </>
      ),
    },
  ];

  const nextImage = () => {
    setCurrentImageIndex((prevIndex) =>
      prevIndex < images.length - 1 ? prevIndex + 1 : 0
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prevIndex) =>
      prevIndex > 0 ? prevIndex - 1 : images.length - 1
    );
  };

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
            value={subjectId}
            onChange={(value) => {
              setSubjectId(value);
            }}
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
            onChange={(value) => setPageNo(value)}
          >
            {pageList.map((page) => (
              <Option key={page.page_no} value={page.page_no}>
                หน้า {page.page_no}
              </Option>
            ))}
          </Select>
        </div>
      </div>
      <Card className="card-edit-recheck">
        <Row gutter={[16, 16]} style={{ height: "100%" }}>
          {/* ด้านซ้าย */}
          <Col
            span={16}
            style={{
              borderRight: "1.7px solid #d7e1ef",
              top: 0,
              bottom: 0,
              height: "900px",
            }}
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
              <div style={{ textAlign: "center", position: "relative" }}>
                <div className="box-text-page">
                  {/* แสดงข้อมูลหน้าปัจจุบัน */}
                  {images.length > 0 && (
                    <div
                      style={{
                        width: "100px",
                        height: "45px",
                        backgroundColor: "#f9f9f9",
                        border: "1px solid #d7e1ef",
                        borderRadius: "8px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        fontSize: "16px",
                        fontWeight: "bold",
                        boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
                      }}
                    >
                      {currentImageIndex + 1}
                    </div>
                  )}
                  {/* แสดง / {images.length} */}
                  {images.length > 0 && (
                    <span
                      style={{
                        marginLeft: "5px", // ระยะห่างจากกล่องตัวเลข
                        fontSize: "16px",
                        fontWeight: "bold",
                        color: "#333", // สีของข้อความ
                      }}
                    >
                      / {images.length}
                    </span>
                  )}
                </div>
                {/* แสดงภาพปัจจุบัน */}
                {images.length > 0 && (
                  <img
                    src={`http://127.0.0.1:5000/${images[currentImageIndex]}`}
                    alt={`Sheet ${currentImageIndex + 1}`}
                    className="show-pic-recheck"
                  />
                )}
              </div>
              {/* ปุ่มเลื่อน */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between", // ปุ่มซ้าย-ขวาอยู่ซ้ายสุดและขวาสุด
                  alignItems: "center", // จัดให้อยู่ตรงกลางแนวตั้ง
                  width: "100%", // กำหนดความกว้างของ container
                  padding: "0 20px", // เพิ่ม padding
                }}
              >
                {/* ปุ่มเลื่อนซ้าย */}
                <LeftOutlined onClick={prevImage} className="circle-button" />

                {/* แถบภาพย่อ */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "10px", // ระยะห่างระหว่างภาพ
                    overflowX: "auto", // เลื่อนแนวนอนได้ถ้าภาพยาวเกินพื้นที่
                    width: "80%", // ขนาดพื้นที่สำหรับ thumbnails
                  }}
                >
                  {images.map((image, index) => (
                    <img
                      key={index}
                      src={`http://127.0.0.1:5000/${image}`}
                      alt={`Thumbnail ${index + 1}`}
                      onClick={() => setCurrentImageIndex(index)} // เปลี่ยนภาพหลักเมื่อคลิก
                      style={{
                        width: "80px", // ขนาดภาพย่อ
                        height: "auto",
                        border:
                          currentImageIndex === index
                            ? "3px solid #007bff"
                            : "1px solid #ccc", // ไฮไลต์ภาพที่เลือก
                        cursor: "pointer",
                        borderRadius: "5px",
                      }}
                    />
                  ))}
                </div>

                {/* ปุ่มเลื่อนขวา */}
                <RightOutlined onClick={nextImage} className="circle-button" />
              </div>
            </div>
          </Col>

          {/* ด้านขวา */}
          <Col span={8} style={{ height: "100%" }}>
            <div className="text-table-container">
              <h1 className="label-recheck-table">Student ID:</h1>
              <h1 className="label-recheck-table">Page:</h1>
            </div>
            <div className="table-container">
              <Table
                className="custom-table"
                dataSource={answers}
                columns={columns}
                rowKey="answer_id"
                pagination={{ pageSize: 10 }}
              />
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Recheck;
