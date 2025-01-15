import React, { useState, useEffect } from "react";
import "../css/recheck.css";
import { Card, Select, Col, Row, Table, message, Flex, Button, Input } from "antd";
import axios from "axios";
import Button2 from "../components/Button";
import { RightOutlined, LeftOutlined } from "@ant-design/icons";
import OverlayBoxes from "../components/OverlayBoxes";

const { Option } = Select;

const A4_WIDTH = 600; // ตั้งค่าความกว้างใหม่
const A4_HEIGHT = (A4_WIDTH / 793.7) * 1122.5; // คำนวณความสูงให้สัมพันธ์กับความกว้างใหม่

const Recheck = () => {
    const [subjectId, setSubjectId] = useState("");
    const [subjectList, setSubjectList] = useState([]);
    const [pageList, setPageList] = useState([]);
    const [pageNo, setPageNo] = useState(null);

    const [sheetList, setSheetList] = useState([]);
    const [startIndex, setStartIndex] = useState(0);

    const [examSheet, setExamSheet] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answerDetails, setAnswerDetails] = useState([]);

    const [editingAnswers, setEditingAnswers] = useState({});
    const [editScorePoint, setEditScorePoint] = useState({});

    const imagesPerPage = 5;
    const endIndex = startIndex + imagesPerPage;

    useEffect(() => {
        if (subjectId && pageNo) {
            fetchExamSheets(pageNo);  // เรียก fetchExamSheets เมื่อ subjectId หรือ pageNo เปลี่ยน
        }
    }, [subjectId, pageNo]); // เพิ่ม dependencies เป็น subjectId และ pageNo    

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
            setCurrentIndex(0); // แสดง index แรกของรายการ Sheet_id
            await fetchSpecificSheet(firstSheetId); // ดึงข้อมูลของ Sheet แรก
        }
        } catch (error) {
        console.error("Error fetching exam sheets:", error);
        }
    };

    const fetchSpecificSheet = async (sheetId) => {
        try {
        const response = await fetch(
            `http://127.0.0.1:5000/find_sheet_by_id/${sheetId}`
        );
            const data = await response.json();
            setExamSheet(data);
            setAnswerDetails(data.answer_details);
            console.log("Answer Details:", data.answer_details);
        } catch (error) {
            console.error("Error fetching specific sheet:", error);
        }
    };

    const updateStudentId = async (sheetId, newId) => {
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

    // ฟังก์ชันจัดการการเปลี่ยนแปลงใน Input
    const handleAnswerChange = (Ans_id, value) => {
        setEditingAnswers((prev) => {
            const updated = {
                ...prev,
                [Ans_id]: value,
            };
            console.log("Current editingAnswers state: ", updated);  // log ค่าที่เปลี่ยนแปลง
            return updated;
        });
    };    
    
    // ฟังก์ชันจัดการเมื่อเลิกแก้ไขและส่งข้อมูลไปยัง backend
    const handleAnswerBlur = async (Ans_id) => {
        const value = editingAnswers[Ans_id];
        console.log("Value before sending to API: ", value);  // log ค่าที่จะส่งไปยัง API
        if (value === undefined) return;
    
        try {
            //console.log(`PUT Request URL: http://127.0.0.1:5000/update_modelread/${Ans_id}`);

            const response = await axios.put(`http://127.0.0.1:5000/update_modelread/${Ans_id}`, {
                modelread: value,
            });
            if (response.data.status === "success") {
                message.success("modelread updated successfully");
                console.log("Update successful: ", response.data);

                // เรียก `fetchExamSheets` เมื่อการอัปเดตสำเร็จ
                await fetchExamSheets(pageNo); // ใช้ pageNo หรือค่าที่ต้องการส่ง
            } else {
                message.error(response.data.message);
            }
        } catch (error) {
            console.error("Error updating answer:", error);
        }
    };

    // ฟังก์ชันจัดการการเปลี่ยนแปลงใน Input
    const handleScorePointChange = (Ans_id, value) => {
        setEditScorePoint((prev) => ({
            ...prev,
            [Ans_id]: value,
        }));
        console.log("Current editScorePoint state: ", { ...editScorePoint, [Ans_id]: value });
    };

    // ฟังก์ชันจัดการเมื่อเลิกแก้ไขและส่งข้อมูลไปยัง backend
    const handleScorePointBlur = async (Ans_id) => {
        const value = editScorePoint[Ans_id]; // ดึงค่า score_point จาก state
        console.log("Value before sending to API: ", value);  // log ค่าที่จะส่งไปยัง API
        if (value === undefined) return; // ถ้าไม่มีค่าไม่ต้องส่ง

        try {
            const response = await axios.put(`http://127.0.0.1:5000/update_scorepoint/${Ans_id}`, {
                score_point: value,
            });
            if (response.data.status === "success") {
                message.success("Score point updated successfully");
                console.log("Update successful: ", response.data);

            } else {
                message.error(response.data.message);
            }
        } catch (error) {
            console.error("Error updating score point:", error);
        }
    };
    
    

    const columns = [
        {
            title: <div style={{ paddingLeft: "20px" }}>ข้อที่</div>,
            dataIndex: "no", // คอลัมน์ที่ใช้ "ข้อที่"
            key: "no",
            render: (text) => (
                <div style={{ textAlign: "left", paddingLeft: "20px" }}>{text}</div>
            ),
        },
        {
            title: "คำตอบ",
            key: "Predict",
            render: (_, record) => {
                if (record.type === "6") {
                    return null; // ไม่แสดงกล่อง Input ถ้า type เป็น "6"
                }
                return (
                    <div>
                        <Input
                            value={editingAnswers[record.Ans_id] ?? record.Predict} // ใช้ค่าเดิมหรือค่าใหม่ที่ถูกแก้ไข
                            onChange={(e) => handleAnswerChange(record.Ans_id, e.target.value)} // เรียกฟังก์ชันเมื่อแก้ไขค่า
                            onBlur={() => handleAnswerBlur(record.Ans_id)} // เรียกฟังก์ชันเมื่อออกจาก Input
                        />
                    </div>
                );
            },
        }, 
        {
            title: "คะแนน",
            dataIndex: "score_point",
            key: "score_point",
            render: (text, record) => {
                return record.type === "3" || record.type === "6"
                    ? (
                        <div>
                            <Input
                                value={editScorePoint[record.Ans_id] ?? record.score_point} // ใช้ค่าเดิมหรือค่าใหม่ที่ถูกแก้ไข
                                onChange={(e) => handleScorePointChange(record.Ans_id, e.target.value)} // เรียกฟังก์ชันเมื่อแก้ไขค่า
                                onBlur={() => handleScorePointBlur(record.Ans_id)} // เรียกฟังก์ชันเมื่อออกจาก Input
                            />
                            <span> / {record.Type_score}</span> {/* แสดงคะแนนเต็ม */}
                        </div>
                    )
                    : `${record.Type_score}`; // แสดงคะแนนเต็ม
            },
        },           
        {
            title: "Action",
            key: "action",
            render: (_, record) => (
              <div
                style={{
                  display: "flex",
                  gap: "10px", // จัดปุ่มให้อยู่ในแถวเดียวกัน
                }}
              >
                {record.type === "6" && (
                  <>
                    {/* ปุ่มสีเขียว */}
                    <Button
                      size="edit"
                      type="primary"
                      style={{
                        backgroundColor: "#67da85", // สีเขียว
                        borderColor: "#67da85", // สีกรอบ
                        borderRadius: "50%", // ปรับให้เป็นวงกลม
                        width: "30px", // ความกว้างปุ่ม
                        height: "30px", // ความสูงปุ่ม
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      ✓
                    </Button>
          
                    {/* ปุ่มสีแดง */}
                    <Button
                      size="edit"
                      type="danger"
                      style={{
                        backgroundColor: "#f3707f", // สีแดง
                        borderColor: "#f3707f", // สีกรอบ
                        borderRadius: "50%", // ปรับให้เป็นวงกลม
                        width: "30px", // ความกว้างปุ่ม
                        height: "30px", // ความสูงปุ่ม
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      ✗
                    </Button>
                  </>
                )}
              </div>
            ),
        }          
    ];

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
                <Row gutter={[16, 16]} style={{ height: "1150px" }}>
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
                                {sheetList.length > 0 && (
                                    <div className="display-text-currentpage">
                                        {currentIndex + 1}
                                    </div>
                                )}
                                {sheetList.length > 0 && (
                                    <span className="display-text-allpage">
                                        / {sheetList.length}
                                    </span>
                                )}
                                </div>
                                <div
                                className="show-pic-recheck"
                                    style={{
                                        width: A4_WIDTH,
                                        height: A4_HEIGHT,
                                        position: "relative",
                                        backgroundImage: examSheet
                                        ? `url(http://127.0.0.1:5000/images/${subjectId}/${pageNo}/${examSheet.Sheet_id})`
                                        : "none",
                                        backgroundSize: "cover",
                                    }}
                                >
                                <OverlayBoxes
                                    subjectId={subjectId}
                                    pageNo={pageNo}
                                    answerDetails={answerDetails}
                                />
                                </div>
                            </div>
        
                            <div className="nextprevpage-space-between">
                                <LeftOutlined
                                    onClick={handlePrevSheet}
                                    disabled={currentIndex === 0}
                                    className="circle-button"
                                />
                                <div className="thumbnail-container-recheck">
                                    {sheetList.slice(startIndex, endIndex).map((sheet, index) => (
                                        <img
                                            key={sheet.Sheet_id}
                                            src={`http://127.0.0.1:5000/images/${subjectId}/${pageNo}/${sheet.Sheet_id}`}
                                            alt={`Thumbnail ${index + 1}`}
                                            onClick={() => setCurrentIndex(startIndex + index)}
                                            className={`thumbnail ${
                                                currentIndex === startIndex + index ? "selected" : ""
                                            }`}
                                        />
                                    ))}
                                </div>
                                <RightOutlined
                                    onClick={handleNextSheet}
                                    disabled={currentIndex === sheetList.length - 1}
                                    className="circle-button"
                                />
                            </div>
                        </div>
                    </Col>

                    {/* ด้านขวา */}
                    <Col span={8} style={{ height: "1150px" }}>
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
                                        const newId = e.target.value;
                                        if (examSheet) {
                                        setExamSheet({ ...examSheet, Id_predict: newId });
                                        updateStudentId(examSheet.Sheet_id, newId);
                                        }
                                    }}
                                    placeholder="Student ID..."
                                />
                            </div>
                            <h1 className="label-recheck-table">
                                Page: {pageNo !== null ? pageNo : "No page selected"}
                            </h1>
                        </div>
                        <div className="table-container">
                            <Table
                                className="custom-table"
                                columns={columns}
                                dataSource={answerDetails.map((ans) => ({ key: ans.Ans_id, ...ans }))}
                                pagination={{ pageSize: 10 }}
                            />
                        </div>
                        {/*<h1 className="label-recheck-table">Total point: {examSheet.score}</h1>*/}
                        <div className="recheck-button-container">
                            <Button2 variant="primary" size="custom">
                                บันทึก
                            </Button2>
                        </div>
                    </Col>
                </Row>
            </Card>
        </div>
    );
};

export default Recheck;