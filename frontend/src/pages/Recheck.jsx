import React, { useState, useEffect } from "react";
import "../css/recheck.css";
import {
  Card,
  Select,
  Col,
  Row,
  Table,
  message,
  Button,
  Input,
  Pagination,
} from "antd";
import axios from "axios";
import Button2 from "../components/Button";
import { RightOutlined, LeftOutlined } from "@ant-design/icons";
import OverlayBoxes from "../components/OverlayBoxes";
import html2canvas from "html2canvas";
import { useLocation } from "react-router-dom";

const { Option } = Select;
const A4_WIDTH = 500;
const A4_HEIGHT = (A4_WIDTH / 793.7) * 1122.5; // คำนวณความสูงให้สัมพันธ์กับความกว้างใหม่

const Recheck = () => {
  const [subjectId, setSubjectId] = useState("");
  const [subjectList, setSubjectList] = useState([]);
  const [pageList, setPageList] = useState([]);
  const [pageNo, setPageNo] = useState(null);
  const [sheetList, setSheetList] = useState([]);

  const [examSheet, setExamSheet] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerDetails, setAnswerDetails] = useState([]);
  const [editingAnswers, setEditingAnswers] = useState({});
  const [newScores, setNewScores] = useState({});
  const [editScorePoint, setEditScorePoint] = useState({});
  const { state } = useLocation();
  const [searchText, setSearchText] = useState("");
  const [foundSheet, setFoundSheet] = useState(null);
  const { Search } = Input;

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const handlePageChange = (page) => {
    setCurrentPage(page); // เมื่อหน้าเปลี่ยนให้ตั้งค่า currentPage
  };
  const startIndex = (currentPage - 1) * pageSize;
  const currentPageData = answerDetails.slice(
    startIndex,
    startIndex + pageSize
  );
  useEffect(() => {
    if (subjectId && pageNo) {
      //console.log(`Fetching exam sheets after resetting currentIndex. Current Index: ${currentIndex}`);
      fetchExamSheets(pageNo); // ดึงข้อมูลหลัง currentIndex ถูกรีเซ็ต
    }
  }, [currentIndex, subjectId, pageNo]); // เรียกใช้เมื่อ currentIndex เปลี่ยน

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/view_subjects");
        const data = await response.json();
        setSubjectList(data);

        if (state?.subjectId) {
          setSubjectId(state.subjectId);
        } else if (data.length > 0) {
          setSubjectId(data[0].Subject_id); // ใช้ key ที่ถูกต้องจาก API
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
          //console.log("Pages fetched:", data);

          setPageList(data);

          if (state?.pageNo) {
            console.log("Setting pageNo from state:", state.pageNo);
            setPageNo(state.pageNo);
          } else if (data.length > 0) {
            console.log("Setting pageNo from first item:", data[0].page_no);
            setPageNo(data[0].page_no);
          }
        } catch (error) {
          console.error("Error fetching pages:", error);
        }
      } else {
        setPageList([]);
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
      console.log("exam_sheets:", data.exam_sheets);
      setSheetList(data.exam_sheets || []);

      if (data.exam_sheets.length > 0) {
        const firstSheetId = data.exam_sheets[0].Sheet_id;
        //console.log(`First Sheet ID: ${firstSheetId}`);

        // ตรวจสอบ currentIndex ก่อนเรียก fetchSpecificSheet
        if (currentIndex !== 0) {
          const currentSheetId = data.exam_sheets[currentIndex]?.Sheet_id;
          //console.log(`Fetching sheet for currentIndex: ${currentIndex}, Sheet ID: ${currentSheetId}`);
          if (currentSheetId) {
            await fetchSpecificSheet(currentSheetId); // ดึงข้อมูลชีทตาม currentIndex
          } else {
            console.error("Invalid currentIndex or Sheet_id not found.");
          }
        } else {
          console.log("CurrentIndex is 0. Fetching first sheet.");
          setCurrentIndex(0); // ตั้งค่า index แรกหาก currentIndex = 0
          await fetchSpecificSheet(firstSheetId); // ดึงข้อมูลชีทแรก
        }
      }
    } catch (error) {
      console.error("Error fetching exam sheets:", error);
    }
  };

  const fetchSpecificSheet = async (sheetId) => {
    try {
      await fetch(
        `http://127.0.0.1:5000/cleanup_duplicate_answers/${sheetId}`,
        {
          method: "POST",
        }
      );

      const response = await fetch(
        `http://127.0.0.1:5000/find_sheet_by_id/${sheetId}`
      );
      const data = await response.json();
      setExamSheet(data);
      //console.log("Updated examSheet:", data); // Log ข้อมูลของ examSheet หลังอัปเดต

      setAnswerDetails(data.answer_details);
      //console.log("Answer Details:", data.answer_details);
      // ตั้งค่า editingAnswers ให้ตรงกับ Predict ของแต่ละ Ans_id
      const newEditingAnswers = {};
      const newScoreMap = {}; // map เก็บ newscore โดยใช้ Ans_id

      data.answer_details.forEach((ans) => {
        newEditingAnswers[ans.Ans_id] = ans.Predict;
        newScoreMap[ans.Ans_id] = ans.score_point; // ดึงค่าจาก score_point มาเก็บ
      });

      setEditingAnswers(newEditingAnswers); // อัปเดตคำตอบ
      setNewScores(newScoreMap); // อัปเดตคะแนนปัจจุบัน
    } catch (error) {
      console.error("Error fetching specific sheet:", error);
    }
  };

  const handleNext = () => {
    let nextIndex = currentIndex + 1;
    if (nextIndex >= sheetList.length) {
      nextIndex = 0; // วนกลับไปหน้าแรก
    }

    const nextSheet = sheetList[nextIndex];
    if (nextSheet?.Sheet_id) {
      fetchSpecificSheet(nextSheet.Sheet_id);
      setCurrentIndex(nextIndex); // ตั้งค่า index หลังจากโหลดข้อมูล
    }
  };

  const handlePrevious = () => {
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = sheetList.length - 1; // วนกลับไปหน้าสุดท้าย
    }

    const prevSheet = sheetList[prevIndex];
    if (prevSheet?.Sheet_id) {
      fetchSpecificSheet(prevSheet.Sheet_id);
      setCurrentIndex(prevIndex); // ตั้งค่า index หลังจากโหลดข้อมูล
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

        await handleCalEnroll();
      } else {
        console.error("Update failed:", result.error);
      }
    } catch (error) {
      console.error("Error updating ID:", error);
    }
  };

  // ฟังก์ชันจัดการการเปลี่ยนแปลงใน Input
  const handleAnswerChange = (Ans_id, value, record) => {
    setEditingAnswers((prev) => ({
      ...prev,
      [Ans_id]: value,
    }));

    // เช็คว่าค่าที่กรอกตรงกับ Predict เดิมหรือไม่
    const newScore = value === record.label ? record.Type_score : 0;

    setNewScores((prev) => ({
      ...prev,
      [Ans_id]: newScore,
    }));
  };

  // ฟังก์ชันจัดการเมื่อเลิกแก้ไขและส่งข้อมูลไปยัง backend
  const handleAnswerBlur = async (Ans_id) => {
    const value = editingAnswers[Ans_id];
    const scoreToUpdate = newScores[Ans_id]; // ดึงคะแนนจาก state

    console.log("Value before sending to API: ", value);
    if (value === undefined || scoreToUpdate === undefined) return;

    try {
      // อัปเดตคะแนนก่อน
      const scoreToUpdate = newScores[Ans_id]; // ใช้ได้แล้วตอนนี้
      const updateScoreResponse = await axios.put(
        `http://127.0.0.1:5000/update_scorepoint/${Ans_id}`,
        {
          score_point: scoreToUpdate,
        }
      );

      // แล้วค่อยอัปเดต modelread
      const response = await axios.put(
        `http://127.0.0.1:5000/update_modelread/${Ans_id}`,
        {
          modelread: value,
        }
      );

      if (response.data.status === "success") {
        message.success("modelread updated successfully");
        console.log("Update successful: ", response.data);

        // คำนวณคะแนนใหม่
        await handleCalScorePage(Ans_id);

        // รีเซ็ตค่าที่ใช้ไปแล้ว
        setEditingAnswers((prev) => {
          const updated = { ...prev };
          delete updated[Ans_id];
          return updated;
        });

        setNewScores((prev) => {
          const updated = { ...prev };
          delete updated[Ans_id];
          return updated;
        });

        // โหลดข้อมูลชีทใหม่
        await fetchSpecificSheet(examSheet.Sheet_id);
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error updating answer:", error);
    }
  };

  const handleCalScorePage = async (Ans_id) => {
    try {
      const response = await axios.post("http://127.0.0.1:5000/cal_scorepage", {
        Ans_id,
        Subject_id: subjectId,
      });
      if (response.data.status === "success") {
        //message.success("Score calculated and updated successfully.");
        console.log("Score calculation successful: ", response.data);
        // เรียก `fetchExamSheets` เมื่อการอัปเดตสำเร็จ
        await fetchSpecificSheet(examSheet.Sheet_id);
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error calculating score:", error);
    }
  };

  const handleCalEnroll = async () => {
    try {
      if (!examSheet?.Sheet_id || !subjectId) {
        console.error("Missing required parameters: Sheet_id or Subject_id");
        return;
      }

      const response = await axios.post("http://127.0.0.1:5000/cal_enroll", {
        Sheet_id: examSheet.Sheet_id,
        Subject_id: subjectId,
      });

      if (response?.data?.status === "success") {
        console.log("Score calculation successful: ", response.data);

        if (typeof fetchExamSheets === "function" && pageNo !== undefined) {
          await fetchSpecificSheet(examSheet.Sheet_id);
        } else {
          console.error("fetchExamSheets is not defined or pageNo is missing");
        }
      } else {
        message.error(response?.data?.message || "Score calculation failed");
      }
    } catch (error) {
      console.error("Error calculating score:", error);
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
        //console.log("Update successful: ", response.data);
        // ล้างค่า editScorePoint หลังอัปเดตสำเร็จ
        setEditScorePoint({});

        // เรียกใช้ /cal_scorepage หลังอัปเดตสำเร็จ
        await handleCalScorePage(Ans_id);
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error updating score point:", error);
    }
  };

  const handleSave = async (examSheet, subjectId, pageNo) => {
    try {
      if (!examSheet?.Sheet_id || !subjectId || !pageNo) {
        message.error(
          "กรุณาใส่ข้อมูล Sheet ID, Subject ID หรือ Page No ให้ครบถ้วน"
        );
        return;
      }

      if (examSheet.same_id !== 1) {
        message.error("รหัสนักศึกษาไม่ตรงกับรหัสนักศึกษาในฐานข้อมูล", 5);
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
      formData.append("pageNo", pageNo); // เพิ่ม pageNo ใน FormData
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
        await handleCalEnroll();
        await fetchSpecificSheet(examSheet.Sheet_id);
      } else {
        message.error("การบันทึกภาพล้มเหลว");
      }
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการบันทึกภาพ:", error);
      message.error("เกิดข้อผิดพลาดในการบันทึกภาพ");
    }
  };

  const handleSearch = (event) => {
    const value = event.target.value;

    if (isNaN(value) && value.trim() !== "") {
      message.error("กรุณากรอกเฉพาะตัวเลข");
      return;
    }

    setSearchText(value);
  };

  const highlightMatch = (text, query) => {
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={index} style={{ backgroundColor: "#d7ebf8" }}>
              {part}
            </span>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </>
    );
  };

  useEffect(() => {
    if (!sheetList || sheetList.length === 0) {
      setFoundSheet(null);
      return;
    }

    const trimmed = searchText.trim();
    if (trimmed === "") {
      setFoundSheet(null);
      return;
    }

    const examSheet = sheetList.find(
      (item) => item.Id_predict && item.Id_predict.includes(trimmed)
    );

    if (examSheet) {
      setFoundSheet(examSheet);
      fetchSpecificSheet(examSheet.Sheet_id);
    } else {
      setFoundSheet(null); // ไม่เจอ
    }
  }, [searchText, sheetList]);

  const columns = [
    {
      title: <div style={{ paddingLeft: "10px" }}>ข้อที่</div>,
      dataIndex: "no",
      key: "no",
      width: 30,
      render: (text) => (
        <div style={{ textAlign: "left", paddingLeft: "10px" }}>{text}</div>
      ),
    },
    {
      title: "คำตอบ",
      key: "Predict",
      width: 50,
      render: (_, record) => {
        if (record.type === "6") {
          return null; // ไม่แสดงกล่อง Input ถ้า type เป็น "6"
        }
        if (record.free === 1) {
          return <span>FREE</span>;
        }

        // ฟังก์ชันตรวจสอบค่าที่ป้อน
        const validateInput = (type, value) => {
          switch (type) {
            case "11":
              if (!/^[0-9]$/.test(value)) {
                message.warning("กรุณากรอกเฉพาะตัวเลข 0-9 เท่านั้น");
                return false;
              }
              return true;
            case "12":
              if (!/^[a-zA-Z]$/.test(value)) {
                message.warning("กรุณากรอกเฉพาะตัวอักษร A-Z เท่านั้น");
                return false;
              }
              return true;
            case "2":
              if (!/^[0-9]{2}$/.test(value)) {
                message.warning("กรุณากรอกเฉพาะตัวเลข 00-99 เท่านั้น");
                return false;
              }
              return true;
            case "3":
              if (!/^[0-9./]*$/.test(value)) {
                message.warning(
                  "กรุณากรอกเฉพาะตัวเลข จุด หรือเครื่องหมาย / เท่านั้น"
                );
                return false;
              }
              return true;
            case "4":
              if (!/^[tTfF]$/.test(value.toUpperCase())) {
                // ใช้ toUpperCase() ที่นี่ด้วย
                message.warning("กรุณากรอกเฉพาะตัวอักษร T หรือ F เท่านั้น");
                return false;
              }
              return true;
            case "51":
              if (!/^[a-dA-D]$/.test(value)) {
                message.warning("กรุณากรอกเฉพาะตัวอักษร A-D เท่านั้น");
                return false;
              }
              return true;
            case "52":
              if (!/^[a-eA-E]$/.test(value)) {
                message.warning("กรุณากรอกเฉพาะตัวอักษร A-E เท่านั้น");
                return false;
              }
              return true;
            default:
              return true;
          }
        };

        // ฟังก์ชันจัดการเมื่อมีการเปลี่ยนแปลงค่า
        const handleInputChange = (id, value, record) => {
          if (value === "") {
            handleAnswerChange(id, "", record); // ส่ง record เข้าไปด้วย
            return;
          }

          const upperValue = value.toUpperCase(); // แปลงเป็นตัวพิมพ์ใหญ่ก่อนตรวจสอบ

          if (validateInput(record.type, upperValue)) {
            handleAnswerChange(id, upperValue, record);
          } else {
            handleAnswerChange(id, "", record);
          }
        };

        // กำหนด maxLength ตามประเภทของข้อมูล
        const maxLength =
          record.type === "2"
            ? 2 // จำกัด 2 ตัวสำหรับ type 2
            : ["11", "12", "4", "51", "52"].includes(record.type)
            ? 1 // จำกัด 1 ตัวสำหรับ type 11, 12, 4, 51, 52
            : undefined; // อื่น ๆ ไม่จำกัด

        const inputStyle = {
          width: record.type === "3" ? "80px" : "55px",
          height: record.type === "3" ? "25px" : "25px",
          whiteSpace: record.type === "3" ? "normal" : "nowrap",
          wordWrap: record.type === "3" ? "break-word" : "normal",
        };

        return (
          <div>
            {record.type === "3" ? (
              <textarea
                className="input-recheck-point textarea"
                style={{
                  ...inputStyle,
                  resize: "vertical",
                }}
                value={editingAnswers[record.Ans_id] ?? record.Predict} // ใช้ค่าเดิมหรือค่าใหม่ที่ถูกแก้ไข
                onChange={(e) =>
                  handleInputChange(record.Ans_id, e.target.value, record)
                } // ตรวจสอบค่าก่อนเปลี่ยนแปลง
                onBlur={() => handleAnswerBlur(record.Ans_id)} // เรียกฟังก์ชันเมื่อออกจาก Input
              />
            ) : (
              <Input
                className="input-recheck-point input"
                style={inputStyle}
                value={editingAnswers[record.Ans_id] ?? record.Predict} // ใช้ค่าเดิมหรือค่าใหม่ที่ถูกแก้ไข
                onChange={(e) =>
                  handleInputChange(record.Ans_id, e.target.value, record)
                } // ตรวจสอบค่าก่อนเปลี่ยนแปลง
                onBlur={() => handleAnswerBlur(record.Ans_id)} // เรียกฟังก์ชันเมื่อออกจาก Input
                onFocus={(e) => e.target.select()}
                maxLength={maxLength} // จำกัดจำนวนตัวอักษรตาม type
              />
            )}
          </div>
        );
      },
    },
    {
      title: "เฉลย",
      key: "label",
      width: 50,
      render: (_, record) => {
        if (record.free === 1) {
          return null; // ไม่แสดงอะไรเลย
        }

        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              paddingLeft: "8px",
            }}
          >
            {record.label}
          </div>
        );
      },
    },
    {
      title: "คะแนน",
      dataIndex: "score_point",
      key: "score_point",
      width: 60,
      render: (text, record) => {
        if (record.Type_score === "") {
          return null; // ไม่แสดงอะไรเลย
        }

        if (record.free === 1) {
          return (
            <span>
              {record.Type_score}
              <span className="score-typeScore" style={{ color: " #8e91a9" }}>
                {" "}
                / {record.Type_score}
              </span>
            </span>
          );
        }

        return record.type === "3" || record.type === "6" ? (
          <div>
            <Input
              className="input-recheck-point"
              style={{
                width: "70px",
                height: "30px",
                appearance: "textfield",
              }}
              type="number"
              min={0}
              max={record.Type_score} // กำหนดค่ามากสุด
              value={editScorePoint[record.Ans_id] ?? record.score_point}
              onChange={(e) => {
                const value = e.target.value;
                if (
                  value === "" ||
                  (Number(value) >= 0 &&
                    Number(value) <= Number(record.Type_score))
                ) {
                  handleScorePointChange(record.Ans_id, value);
                } else {
                  // แจ้งเตือนผู้ใช้หากเกินค่าคะแนนเต็ม
                  alert(`คะแนนต้องอยู่ในช่วง 0 - ${record.Type_score}`);
                }
              }}
              onBlur={() => handleScorePointBlur(record.Ans_id)}
            />
            <span className="score-typeScore" style={{ color: " #8e91a9" }}>
              {" "}
              / {record.Type_score}
            </span>
          </div>
        ) : (
          <span>
            {record.score_point ?? 0}
            <span className="score-typeScore" style={{ color: " #8e91a9" }}>
              {" "}
              / {record.Type_score}
            </span>
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <div className="input-group-std">
        <h1 className="Title-recheck">Recheck</h1>
        <div className="dropdown-group">
          <label className="label-std">วิชา: </label>
          <Select
            className="custom-select responsive-custom-select-2"
            // className="custom-select"
            value={subjectId || undefined}
            onChange={(value) => setSubjectId(value)}
            // style={{ width: "250px", height: "30px", fontSize: "5px" }}
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
          <label className="label-std">เลขหน้า: </label>
          <Select
            className="custom-select responsive-custom-select-3"
            // className="custom-select "
            value={pageNo || undefined}
            onChange={(value) => {
              setPageNo(value);
              fetchExamSheets(value); // เรียกฟังก์ชันเมื่อเลือกหน้ากระดาษ
            }}
            // style={{ width: "160px", height: "30px" }}
            placeholder="เลือกหน้ากระดาษคำตอบ..."
          >
            {pageList.map((page) => (
              <Option key={page.page_no} value={page.page_no}>
                หน้า {page.page_no}
              </Option>
            ))}
          </Select>
        </div>

        <Search
          className="custom-search-recheck"
          placeholder="ค้นหา Student ID..."
          allowClear
          value={searchText}
          onChange={handleSearch}
          style={{ width: "270px" }}
        />
      </div>

      <Card className="card-edit-recheck">
        <Row gutter={[16, 16]} style={{ height: "auto" }}>
          {/* ด้านซ้าย */}
          <Col
            span={14}
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
                  {searchText.trim() !== "" && (
                    <>
                      {foundSheet ? (
                        <div>
                          รหัสที่ค้นหาเจอ:{" "}
                          {highlightMatch(
                            foundSheet.Id_predict,
                            searchText.trim()
                          )}
                        </div>
                      ) : (
                        <div style={{ color: "red" }}>
                          ไม่พบรหัสนักศึกษาในระบบ
                        </div>
                      )}
                    </>
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
                    fetchExamSheets={fetchExamSheets}
                    handleCalScorePage={handleCalScorePage}
                    examSheet={examSheet}
                    setExamSheet={setExamSheet}
                  />
                </div>
                {searchText.trim() === "" && (
                  <div className="pagination-below-pic">
                    <Button
                      shape="circle"
                      icon={<LeftOutlined />}
                      onClick={handlePrevious}
                      disabled={sheetList.length === 0}
                    />
                    <Pagination
                      current={currentIndex + 1}
                      total={sheetList.length}
                      pageSize={1}
                      showSizeChanger={false}
                      onChange={(page) => {
                        const newIndex = page - 1;
                        setCurrentIndex(newIndex);
                        const selectedSheet = sheetList[newIndex];
                        if (selectedSheet?.Sheet_id) {
                          fetchSpecificSheet(selectedSheet.Sheet_id);
                        }
                      }}
                      itemRender={(page, type, originalElement) => {
                        if (type === "prev" || type === "next") {
                          return null;
                        }
                        return originalElement;
                      }}
                      style={{ textAlign: "center" }}
                    />
                    <Button
                      shape="circle"
                      icon={<RightOutlined />}
                      onClick={handleNext}
                      disabled={sheetList.length === 0}
                    />
                  </div>
                )}
              </div>
            </div>
          </Col>

          {/* ด้านขวา */}
          <Col span={10} style={{ height: "auto" }}>
            <div>
              <div className="page-student-id">
                <div className="box-text-page">
                  <div className="display-text-currentpage">
                    {currentIndex + 1}
                  </div>
                  <span className="display-text-allpage">
                    / {sheetList.length}
                  </span>
                </div>
                <h1
                  className="label-recheck-table"
                  style={{ color: "#1e497b" }}
                >
                  StudentID:
                </h1>
                <input
                  className={`student-id-input ${
                    examSheet?.same_id === 1 ? "correct" : "incorrect"
                  }`}
                  type="text"
                  value={examSheet ? examSheet.Id_predict : ""}
                  onChange={(e) => {
                    const newId = e.target.value;
                    if (examSheet) {
                      setExamSheet({ ...examSheet, Id_predict: newId });
                    }
                  }}
                  onBlur={() => {
                    if (examSheet) {
                      updateStudentId(examSheet.Sheet_id, examSheet.Id_predict);
                    }
                  }}
                  placeholder="Student ID..."
                />
              </div>
            </div>
            <div className="recheck-container-right">
              <div className="table-container">
                <Table
                  className="custom-table-recheck"
                  columns={columns}
                  dataSource={currentPageData}
                  pagination={false}
                />{" "}
              </div>
              <div className="pagination-score">
                <div className="total-score-display">
                  <h1
                    className="label-recheck-table"
                    style={{ color: "#1e497b" }}
                  >
                    Total point:{" "}
                    {examSheet &&
                    examSheet.score !== null &&
                    examSheet.score !== undefined
                      ? examSheet.score
                      : " "}
                  </h1>
                  {examSheet && examSheet.status === 1 && (
                    <h1
                      className="label-recheck-table-score"
                      style={{ color: "#2aad2a" }}
                    >
                      Status: OK
                    </h1>
                  )}
                </div>
                <div className="pagination-container">
                  <Pagination
                    simple
                    current={currentPage}
                    total={answerDetails.length}
                    pageSize={pageSize}
                    onChange={handlePageChange}
                    showSizeChanger={false}
                    showQuickJumper={false}
                    size="small"
                    showLessItems={false}
                    showTitle={true}
                  />
                </div>
              </div>
              <div className="recheck-button-container">
                <Button2
                  variant="primary"
                  size="btt-recheck"
                  onClick={() => handleSave(examSheet, subjectId, pageNo)}
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
