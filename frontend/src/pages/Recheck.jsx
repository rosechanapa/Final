import React, { useState, useEffect } from "react";
import "../css/recheck.css";
import { Card, Select, Col, Row, Table, message, Button } from "antd";
import axios from "axios";
import Button2 from "../components/Button";
import { RightOutlined, LeftOutlined, CheckOutlined } from "@ant-design/icons";
import OverlayBoxes from "../components/OverlayBoxes";
import html2canvas from "html2canvas";

const { Option } = Select;

const A4_WIDTH = 700;
const A4_HEIGHT = (A4_WIDTH / 793.7) * 1122.5;
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
  const hasType6 = answerDetails.some((record) => record.type === "6");

  const imagesPerPage = 5;
  const endIndex = startIndex + imagesPerPage;

  useEffect(() => {
    if (subjectId && pageNo) {
      fetchExamSheets(pageNo); // เรียก fetchExamSheets เมื่อ subjectId หรือ pageNo เปลี่ยน
      //console.log(`Resetting currentIndex to 0. subjectId: ${subjectId}, pageNo: ${pageNo}`);
      setCurrentIndex(0); // รีเซ็ต currentIndex
    }
  }, [subjectId, pageNo]); // เพิ่ม dependencies เป็น subjectId และ pageNo
  // รีเซ็ตเมื่อ subjectId หรือ pageNo เปลี่ยน

  useEffect(() => {
    if (currentIndex === 0 && subjectId && pageNo) {
      //console.log(`Fetching exam sheets after resetting currentIndex. Current Index: ${currentIndex}`);
      fetchExamSheets(pageNo); // ดึงข้อมูลหลัง currentIndex ถูกรีเซ็ต
    }
  }, [currentIndex, subjectId, pageNo]); // เรียกใช้เมื่อ currentIndex เปลี่ยน
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/get_subjects");
        const data = await response.json();
        setSubjectList(data);

        if (data.length > 0) {
          const firstSubjectId = data[0].Subject_id;
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
        setPageList([]);
      }
    };

    fetchPages();
  }, [subjectId]);

  const fetchSpecificSheet = async (sheetId) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/find_sheet_by_id/${sheetId}`
      );
      const data = await response.json();
      setExamSheet(data);
      console.log("Updated examSheet:", data); // Log ข้อมูลของ examSheet หลังอัปเดต

      setAnswerDetails(data.answer_details);
      //console.log("Answer Details:", data.answer_details);
      // ตั้งค่า editingAnswers ให้ตรงกับ Predict ของแต่ละ Ans_id
      const newEditingAnswers = {};
      data.answer_details.forEach((ans) => {
        newEditingAnswers[ans.Ans_id] = ans.Predict;
      });
      setEditingAnswers(newEditingAnswers); // อัปเดต state
    } catch (error) {
      console.error("Error fetching specific sheet:", error);
    }
  };

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

        // ตรวจสอบ currentIndex ก่อนเรียก fetchSpecificSheet
        if (currentIndex !== 0) {
          const currentSheetId = data.exam_sheets[currentIndex]?.Sheet_id;
          if (currentSheetId) {
            await fetchSpecificSheet(currentSheetId); // ดึงข้อมูลชีทตาม currentIndex
          } else {
            console.error("Invalid currentIndex or Sheet_id not found.");
          }
        } else {
          setCurrentIndex(0); // ตั้งค่า index แรกหาก currentIndex = 0
          await fetchSpecificSheet(firstSheetId); // ดึงข้อมูลชีทแรก
        }
      }
    } catch (error) {
      console.error("Error fetching exam sheets:", error);
    }
  };
  const handleCalScorePage = async (Ans_id) => {
    try {
      const response = await axios.post("http://127.0.0.1:5000/cal_scorepage", {
        Ans_id,
        Subject_id: subjectId,
      });
      if (response.data.status === "success") {
        message.success("Score calculated and updated successfully.");
        console.log("Score calculation successful: ", response.data);
        await handleCalScorePage(Ans_id);
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error calculating score:", error);
    }
  };

  const handleAnswerChange = (Ans_id, value) => {
    setEditingAnswers((prev) => {
      const updated = {
        ...prev,
        [Ans_id]: value,
      };
      console.log("Current editingAnswers state: ", updated); // log ค่าที่เปลี่ยนแปลง
      return updated;
    });
  };

  // ฟังก์ชันจัดการเมื่อเลิกแก้ไขและส่งข้อมูลไปยัง backend
  const handleAnswerBlur = async (Ans_id) => {
    const value = editingAnswers[Ans_id];
    console.log("Value before sending to API: ", value); // log ค่าที่จะส่งไปยัง API
    if (value === undefined) return;

    try {
      //console.log(`PUT Request URL: http://127.0.0.1:5000/update_modelread/${Ans_id}`);

      const response = await axios.put(
        `http://127.0.0.1:5000/update_modelread/${Ans_id}`,
        {
          modelread: value,
        }
      );
      if (response.data.status === "success") {
        message.success("modelread updated successfully");
        console.log("Update successful: ", response.data);
        await handleCalScorePage(Ans_id);

        await fetchExamSheets(pageNo);
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
    console.log("Current editScorePoint state: ", {
      ...editScorePoint,
      [Ans_id]: value,
    });
  };

  // ฟังก์ชันจัดการเมื่อเลิกแก้ไขและส่งข้อมูลไปยัง backend
  const handleScorePointBlur = async (Ans_id) => {
    const value = editScorePoint[Ans_id]; // ดึงค่า score_point จาก state
    console.log("Value before sending to API: ", value); // log ค่าที่จะส่งไปยัง API
    if (value === undefined) return; // ถ้าไม่มีค่าไม่ต้องส่ง

    try {
      const response = await axios.put(
        `http://127.0.0.1:5000/update_scorepoint/${Ans_id}`,
        {
          score_point: value,
        }
      );
      if (response.data.status === "success") {
        message.success("Score point updated successfully");
        console.log("Update successful: ", response.data);
        await fetchExamSheets(pageNo);
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error updating score point:", error);
    }
  };

  const Full_point = async (Ans_id, Type_score) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/update_scorepoint/${Ans_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            score_point: Type_score, // ส่งคะแนนเต็มเป็น score_point
          }),
        }
      );

      const result = await response.json(); // แปลง response เป็น JSON

      if (result.status === "success") {
        // ตรวจสอบสถานะจาก result
        console.log("Updated successfully:", result.message);
        await fetchExamSheets(pageNo); // ใช้ pageNo หรือค่าที่ต้องการส่ง
        //message.success("Score point updated successfully");
        //alert("Success: คะแนนถูกอัปเดตเรียบร้อยแล้ว"); // เปลี่ยนเป็น alert แทน notification หรือใช้งานตามต้องการ
      } else {
        console.error("Error:", result.message);
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error("Error during update:", error);
      alert("Error: ไม่สามารถอัปเดตคะแนนได้");
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

  const handleSave = async (examSheet, subjectId) => {
    try {
      if (!examSheet?.Sheet_id || !subjectId) {
        message.error("กรุณาใส่ข้อมูล Sheet ID หรือ Subject ID ให้ครบถ้วน");
        return;
      }

      const element = document.querySelector(".show-pic-recheck");
      if (!element) {
        message.error("ไม่พบองค์ประกอบที่จะทำการแคปเจอร์");
        return;
      }

      const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: true,
      });

      const imageBlob = await new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg");
      });

      if (!imageBlob) {
        message.error("เกิดข้อผิดพลาดในการจับภาพ");
        return;
      }

      console.log("Image Blob:", imageBlob);

      const formData = new FormData();
      formData.append("examSheetId", examSheet.Sheet_id);
      formData.append("subjectId", subjectId);
      formData.append("image", imageBlob, `${examSheet.Sheet_id}.jpg`);

      const response = await axios.post(
        "http://127.0.0.1:5000/get_imgcheck",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (response.status === 200) {
        message.success("บันทึกภาพสำเร็จ!");
      } else {
        message.error("การบันทึกภาพล้มเหลว");
      }
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการบันทึกภาพ:", error);
      message.error("เกิดข้อผิดพลาดในการบันทึกภาพ");
    }
  };
  const columns = [
    {
      title: <div style={{ paddingLeft: "20px" }}>ข้อที่</div>,
      dataIndex: "no",
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
          return null;
        }
        const inputStyle = {
          width: record.type === "3" ? "100px" : "100px",
          height: record.type === "3" ? "30px" : "30px",
          whiteSpace: record.type === "3" ? "normal" : "nowrap",
          wordWrap: record.type === "3" ? "break-word" : "normal",
        };

        return (
          <div>
            {record.type === "3" ? (
              <textarea
                className="input-recheck-point"
                style={{
                  ...inputStyle,
                  resize: "vertical",
                }}
                value={editingAnswers[record.Ans_id] ?? record.Predict}
                onChange={(e) =>
                  handleAnswerChange(record.Ans_id, e.target.value)
                }
                onBlur={() => handleAnswerBlur(record.Ans_id)}
              />
            ) : (
              <input
                className="input-recheck-point"
                style={inputStyle}
                value={editingAnswers[record.Ans_id] ?? record.Predict}
                onChange={(e) =>
                  handleAnswerChange(record.Ans_id, e.target.value)
                }
                onBlur={() => handleAnswerBlur(record.Ans_id)}
              />
            )}
          </div>
        );
      },
    },
    {
      title: "คะแนน",
      dataIndex: "score_point",
      key: "score_point",
      render: (text, record) => {
        if (record.Type_score === "") {
          return null; // ไม่แสดงอะไรเลย
        }
        return record.type === "3" || record.type === "6" ? (
          <div>
            <input
              className="input-recheck-point"
              style={{
                width: "60px",
                height: "30px",
              }}
              value={editScorePoint[record.Ans_id] ?? record.score_point}
              onChange={(e) =>
                handleScorePointChange(record.Ans_id, e.target.value)
              }
              onBlur={() => handleScorePointBlur(record.Ans_id)}
            />
            <span> / {record.Type_score}</span>
          </div>
        ) : (
          `${record.Type_score}`
        );
      },
    },
    ...(hasType6
      ? [
          {
            title: "Action",
            key: "action",
            render: (_, record) => (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                }}
              >
                {record.type === "6" && record.Type_score !== "" && (
                  <>
                    <Button
                      size="edit"
                      type="primary"
                      className="btt-circle-action"
                      style={{
                        backgroundColor: "#67da85", // สีเขียว
                        borderColor: "#67da85", // สีกรอบ
                      }}
                      onClick={() =>
                        Full_point(record.Ans_id, record.Type_score)
                      } // ส่งค่า Type_score เป็นคะแนนเต็ม
                    >
                      <CheckOutlined />
                    </Button>
                  </>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  const handleNextSheet = () => {
    if (currentIndex < sheetList.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      fetchSpecificSheet(sheetList[nextIndex].Sheet_id);

      // ปรับ startIndex หาก nextIndex เกินภาพที่แสดงผล
      if (nextIndex >= startIndex + 5) {
        setStartIndex((prevStartIndex) => prevStartIndex + 1);
      }
    }
  };

  const handlePrevSheet = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      fetchSpecificSheet(sheetList[prevIndex].Sheet_id);

      // ปรับ startIndex หาก prevIndex น้อยกว่าภาพที่แสดงผล
      if (prevIndex < startIndex) {
        setStartIndex((prevStartIndex) => prevStartIndex - 1);
      }
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
              fetchExamSheets(value);
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
        <Row gutter={[16, 16]} style={{ height: "auto" }}>
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
                    fetchExamSheets={fetchExamSheets} // ส่งฟังก์ชัน fetchExamSheets
                    handleCalScorePage={handleCalScorePage} // ส่งฟังก์ชัน handleCalScorePage
                    examSheet={examSheet} // ส่ง state examSheet
                    setExamSheet={setExamSheet}
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
                      onClick={() => {
                        setCurrentIndex(startIndex + index); // อัปเดต index ของภาพปัจจุบัน
                        fetchSpecificSheet(sheet.Sheet_id); // โหลดภาพใหม่ตาม Sheet_id
                      }}
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
          <Col span={8} style={{ width: "auto", height: "auto" }}>
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
                Page: {pageNo !== null ? pageNo : "-"}
              </h1>
            </div>
            <div className="recheck-container-right">
              <div className="table-container">
                <Table
                  className="custom-table"
                  columns={columns}
                  dataSource={answerDetails.map((ans, index) => ({
                    key: `${ans.Ans_id}-${index}`,
                    ...ans,
                  }))}
                  pagination={{
                    pageSize: 14,
                    showSizeChanger: false,
                  }}
                />
              </div>
              <h1 className="label-recheck-table">
                Total point:{" "}
                {examSheet &&
                examSheet.score !== null &&
                examSheet.score !== undefined
                  ? examSheet.score
                  : "ยังไม่มีข้อมูล"}
              </h1>
              {examSheet && examSheet.status === 1 && (
                <h1 className="label-recheck-table">Status: OK</h1>
              )}
              <div className="recheck-button-container">
                <Button2
                  variant="primary"
                  size="custom"
                  onClick={() => handleSave(examSheet, subjectId)}
                >
                  บันทึก
                </Button2>
              </div>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Recheck;
