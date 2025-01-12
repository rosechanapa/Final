import React, { useState, useEffect } from "react";
import "../css/recheck.css";
import { Card, Select, Col, Row, Table, message, Flex } from "antd";
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
  const [startIndex, setStartIndex] = useState(0);
  const [pageNo, setPageNo] = useState(null);
  const [studentPageData, setStudentPageData] = useState({});
  const [editedStudentId, setEditedStudentId] = useState("");
  const [currentSheetId, setCurrentSheetId] = useState(null);

  const imagesPerPage = 5;
  const endIndex = startIndex + imagesPerPage;

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
      if (!subjectId || !pageNo) return;

      try {
        const response = await axios.get("http://127.0.0.1:5000/get_answers", {
          params: {
            subject_id: subjectId,
            page_no: pageNo,
            sheet_id: studentPageData?.sheet_id,
          },
        });

        console.log("Response from API:", response.data); // Debug ทั้ง response
        if (response.data.success) {
          console.log("Fetched answers:", response.data.answers); // Debug ค่าที่ต้องการ
          setAnswers(response.data.answers); // ตั้งค่า answers ที่จะส่งให้ Table
        } else {
          console.error("Failed to fetch answers:", response.data.message);
          setAnswers([]); // รีเซ็ตหากไม่มีข้อมูล
        }
      } catch (error) {
        console.error("Error fetching answers:", error);
        setAnswers([]); // รีเซ็ตหากเกิดข้อผิดพลาด
      }
    };

    fetchAnswers();
  }, [subjectId, pageNo, studentPageData?.sheet_id]);

  useEffect(() => {
    const fetchStudentPageData = async () => {
      if (!subjectId || pageNo === null) return;
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/get_student_page?subject_id=${subjectId}&page_no=${pageNo}&index=${currentImageIndex}`
        );
        if (response.data.success) {
          console.log("Student Page Data:", response.data.data); // Debug
          setStudentPageData(response.data.data);
        } else {
          console.error(
            "Failed to fetch student-page data:",
            response.data.message
          );
          setStudentPageData(null);
        }
      } catch (error) {
        console.error("Error fetching student-page data:", error);
        setStudentPageData(null);
      }
    };

    fetchStudentPageData();
  }, [subjectId, pageNo, currentImageIndex]);

  const updateStudentId = async (newStudentId) => {
    try {
      if (!studentPageData?.sheet_id) {
        console.error("Sheet ID is missing in studentPageData");
        message.error("Cannot update Student ID: Sheet ID is missing.");
        return;
      }

      console.log("Preparing to update Student ID with the following data:", {
        subject_id: subjectId,
        page_no: pageNo,
        sheet_id: studentPageData.sheet_id, // ใช้ sheet_id ที่ได้รับจาก backend
        new_student_id: newStudentId,
      });

      const response = await axios.post(
        "http://127.0.0.1:5000/update_student_id",
        {
          subject_id: subjectId,
          page_no: pageNo,
          sheet_id: studentPageData.sheet_id, // ส่ง sheet_id
          new_student_id: newStudentId,
        }
      );

      if (response.data.success) {
        message.success("Student ID updated successfully");
        setStudentPageData((prev) => ({
          ...prev,
          student_id: newStudentId,
        }));
      } else {
        message.error("Failed to update Student ID: " + response.data.message);
      }
    } catch (error) {
      console.error("Error updating Student ID:", error);
      message.error("An error occurred while updating Student ID.");
    }
  };

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
      dataIndex: "answer", // เพิ่มจาก Label table
      key: "answer",
      render: (text) => text || "ไม่มีข้อมูล",
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <>
          <Button size="edit" type="primary" style={{ marginRight: 10 }}>
            Green
          </Button>
          <Button size="edit" type="danger">
            Red
          </Button>
        </>
      ),
    },
  ];

  const nextImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  const prevImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex((prevIndex) =>
      prevIndex - 1 >= 0 ? prevIndex - 1 : images.length - 1
    );
  };

  const handlePrev = () => {
    if (startIndex > 0) {
      setStartIndex((prevStartIndex) => prevStartIndex - imagesPerPage);
      setCurrentImageIndex((prevIndex) => prevIndex - 1); // เลื่อน Student ID ถอยหลัง
    }
  };

  // เลื่อนแกลเลอรีไปหน้า Next
  const handleNext = () => {
    if (endIndex < images.length) {
      setStartIndex((prevStartIndex) => prevStartIndex + imagesPerPage);
      setCurrentImageIndex((prevIndex) => prevIndex + 1); // เลื่อน Student ID ถัดไป
    }
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
        <Row gutter={[16, 16]} style={{ height: "1050px" }}>
          {/* ด้านซ้าย */}
          <Col
            span={16}
            style={{
              borderRight: "1.7px solid #d7e1ef",
              top: 0,
              bottom: 0,
              height: "auto",
            }}
          >
            <div className="card-left-recheck">
              <div style={{ textAlign: "center", position: "relative" }}>
                <div className="box-text-page">
                  {images.length > 0 && (
                    <div className="display-text-currentpage">
                      {currentImageIndex + 1}
                    </div>
                  )}
                  {images.length > 0 && (
                    <span className="display-text-allpage">
                      / {images.length}
                    </span>
                  )}
                </div>
                {images.length > 0 && (
                  <img
                    src={`http://127.0.0.1:5000/${images[currentImageIndex]}`}
                    alt={`Sheet ${currentImageIndex + 1}`}
                    className="show-pic-recheck"
                  />
                )}
              </div>

              <div className="nextprevpage-space-between">
                <LeftOutlined
                  onClick={prevImage}
                  disabled={startIndex === 0}
                  className="circle-button"
                />
                <div className="thumbnail-container-recheck">
                  {images.slice(startIndex, endIndex).map((image, index) => (
                    <img
                      key={index + startIndex}
                      src={`http://127.0.0.1:5000/${image}`}
                      alt={`Thumbnail ${startIndex + index + 1}`}
                      onClick={() => setCurrentImageIndex(startIndex + index)}
                      className={`thumbnail ${
                        currentImageIndex === startIndex + index
                          ? "selected"
                          : ""
                      }`}
                    />
                  ))}
                </div>
                <RightOutlined
                  onClick={nextImage}
                  disabled={endIndex >= images.length}
                  className="circle-button"
                />
              </div>
            </div>
          </Col>

          {/* ด้านขวา */}
          <Col span={8} style={{ height: "1050px" }}>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "20px",
                }}
              >
                <h1 className="label-recheck-table">Student ID :</h1>
                <input
                  className="student-id-input"
                  value={editedStudentId || studentPageData?.student_id || ""}
                  onChange={(e) => setEditedStudentId(e.target.value)}
                  onBlur={() => {
                    if (editedStudentId !== studentPageData?.student_id) {
                      updateStudentId(editedStudentId);
                    }
                  }}
                  placeholder="Student ID..."
                />
              </div>
              <h1 className="label-recheck-table">
                Page: {studentPageData?.page_no || "-"}
              </h1>
            </div>
            <div className="table-container">
              <Table
                className="custom-table"
                dataSource={answers}
                columns={columns}
                rowKey="answer_id"
                pagination={{ pageSize: 9 }}
              />
            </div>
            <h1 className="label-recheck-table">Total point:</h1>
            <div className="recheck-button-container">
              <Button variant="primary" size="custom">
                บันทึก
              </Button>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Recheck;
