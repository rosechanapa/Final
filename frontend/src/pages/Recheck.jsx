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
    const [pageNo, setPageNo] = useState("");

    const [examSheet, setExamSheet] = useState(null);  // เก็บข้อมูล sheet ปัจจุบัน
    const [currentIndex, setCurrentIndex] = useState(0);  // index ของ Sheet_id ปัจจุบัน
    const [sheetList, setSheetList] = useState([]);    // เก็บรายการ Sheet_id ทั้งหมด
    const [answerDetails, setAnswerDetails] = useState([]); // กำหนดค่า state สำหรับเก็บ answer_details


    useEffect(() => {
        const fetchSubjects = async () => {
          try {
            const response = await fetch("http://127.0.0.1:5000/get_subjects");
            const data = await response.json();
            setSubjectList(data);
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

    const fetchExamSheets = async (selectedPageNo) => {
        try {
            const response = await fetch("http://127.0.0.1:5000/find_sheet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pageNo: selectedPageNo, subjectId }),
            });
            const data = await response.json();
            setSheetList(data.exam_sheets || []);
    
            if (data.exam_sheets.length > 0) {
                const firstSheetId = data.exam_sheets[0].Sheet_id;
                setCurrentIndex(0);  // แสดง index แรกของรายการ Sheet_id
                await fetchSpecificSheet(firstSheetId);  // ดึงข้อมูลของ Sheet แรก
            }
        } catch (error) {
            console.error("Error fetching exam sheets:", error);
        }
    };
    
    const fetchSpecificSheet = async (sheetId) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000/find_sheet_by_id/${sheetId}`);
            const data = await response.json();
            setExamSheet(data);
            setAnswerDetails(data.answer_details);
        } catch (error) {
            console.error("Error fetching specific sheet:", error);
        }
    };

    const handleNextSheet = () => {
        if (currentIndex < sheetList.length - 1) {
            const nextIndex = currentIndex + 1;
            setCurrentIndex(nextIndex);
            fetchSpecificSheet(sheetList[nextIndex].Sheet_id);
        }
    };

    const handlePrevSheet = () => {
        if (currentIndex > 0) {
            const prevIndex = currentIndex - 1;
            setCurrentIndex(prevIndex);
            fetchSpecificSheet(sheetList[prevIndex].Sheet_id);
        }
    };

    const edit_ID = async (sheetId, newId) => {
        try {
            const response = await fetch("http://127.0.0.1:5000/edit_predictID", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sheet_id: sheetId, new_id: newId }),
            });
    
            const result = await response.json();
            if (result.success) {
                console.log("Updated successfully!");
            } else {
                console.error("Update failed:", result.error);
            }
        } catch (error) {
            console.error("Error updating ID:", error);
        }
    };
    
      
    const columns = [
    {
        title: <div style={{ paddingLeft: "20px" }}>ข้อที่</div>,  // ข้อที่
        dataIndex: "no",  // คอลัมน์ที่ใช้ "ข้อที่"
        key: "no",
        width: 30,
    },
    {
        title: "ผลการทำนาย",  // ผลการทำนาย
        dataIndex: "Predict",  // คอลัมน์ที่ใช้ "Predict"
        key: "Predict",
        width: 100,
    },
    {
        title: "เฉลย",  // เฉลย
        dataIndex: "label",  // คอลัมน์ที่ใช้ "label"
        key: "label",
        width: 100,
    },
    ];
    

    

    return (
        <div>
            <h1 className="Title">Recheck</h1>
            <div className="input-group-std">
                <div className="dropdown-group">
                    <label className="label-std">วิชา: </label>
                    <Select
                        className="custom-select"
                        value={subjectId || undefined}
                        onChange={(value) => setSubjectId(value)}
                        placeholder="กรุณาเลือกรหัสวิชา..."
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
                    <label className="label-std">เลขหน้า: </label>
                    <Select
                    className="custom-select"
                    value={pageNo || undefined}
                    onChange={(value) => {
                        setPageNo(value);
                        fetchExamSheets(value); // เรียกฟังก์ชันเมื่อเลือกหน้ากระดาษ
                    }}
                    placeholder="กรุณาเลือกหน้ากระดาษคำตอบ..."
                    style={{ width: 340, height: 40 }}
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
                                    {sheetList.length > 0 ? `${currentIndex + 1}/${sheetList.length}` : "No sheets available"}
                                </div>

                                {/* แสดงภาพ */}
                                {examSheet?.Sheet_id ? (
                                    <img
                                        src={`http://127.0.0.1:5000/sheet_image/${examSheet.Sheet_id}?subject_id=${subjectId}&page_no=${pageNo}`}
                                        alt="Sheet Preview"
                                        style={{ width: "100%", height: "auto", borderRadius: "5px" }}
                                    />
                                ) : (
                                    <p>No image available</p>
                                )}

                            </div>

                            <div className="nextprevpage-space-between">
                                <LeftOutlined onClick={handlePrevSheet} disabled={currentIndex === 0} />
                                <div className="thumbnail-container-recheck">
                                    
                                </div>
                                <RightOutlined onClick={handleNextSheet} disabled={currentIndex === sheetList.length - 1} />
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
                                    type="text"
                                    value={examSheet ? examSheet.Id_predict : ""}
                                    onChange={(e) => {
                                        const newId = e.target.value;  // รับค่าที่กรอกใหม่
                                        if (examSheet) {
                                            setExamSheet({ ...examSheet, Id_predict: newId });  // อัปเดต state
                                            edit_ID(examSheet.Sheet_id, newId);  // เรียกฟังก์ชันส่งไป backend
                                        }
                                    }}
                                />
                            </div>

                            </div>
                            <div className="table-container">
                                <Table columns={columns} dataSource={answerDetails.map((ans, i) => ({ key: i, ...ans }))} />
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
