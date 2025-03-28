import React, { useState, useEffect } from "react";
import "../css/recheck.css";
import { Card, Select, Col, Row, Table, message, Input, Tooltip } from "antd";
import axios from "axios";
import Button2 from "../components/Button";
import { RightOutlined, LeftOutlined, CheckOutlined } from "@ant-design/icons";
import OverlayBoxes from "../components/OverlayBoxes";
import html2canvas from "html2canvas";
import { useLocation } from "react-router-dom";

const { Option } = Select;

const A4_WIDTH = 500;
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

  const imagesPerPage = 5;
  const endIndex = startIndex + imagesPerPage;

  const { state } = useLocation();
  const [searchText, setSearchText] = useState("");
  const { Search } = Input;

  useEffect(() => {
    if (subjectId && pageNo) {
      //console.log(`Resetting currentIndex to 0. subjectId: ${subjectId}, pageNo: ${pageNo}`);
      setCurrentIndex(0); // รีเซ็ต currentIndex
    }
  }, [subjectId, pageNo]); // รีเซ็ตเมื่อ subjectId หรือ pageNo เปลี่ยน

  useEffect(() => {
    if (currentIndex === 0 && subjectId && pageNo) {
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
      data.answer_details.forEach((ans) => {
        newEditingAnswers[ans.Ans_id] = ans.Predict;
      });
      setEditingAnswers(newEditingAnswers); // อัปเดต state
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

        await handleCalEnroll();
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

        // เรียกใช้ /cal_scorepage หลังอัปเดตสำเร็จ
        await handleCalScorePage(Ans_id);
        setEditingAnswers({});

        // เรียก `fetchExamSheets` เมื่อการอัปเดตสำเร็จ
        await fetchSpecificSheet(examSheet.Sheet_id); // ใช้ pageNo หรือค่าที่ต้องการส่ง
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
        await fetchSpecificSheet(examSheet.Sheet_id);
      } else {
        message.error("การบันทึกภาพล้มเหลว");
      }
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการบันทึกภาพ:", error);
      message.error("เกิดข้อผิดพลาดในการบันทึกภาพ");
    }
  };

  // อัปเดต searchText ทุกครั้งที่พิมพ์
  const handleSearch = (event) => {
    setSearchText(event.target.value);
  };

  useEffect(() => {
    if (!sheetList || sheetList.length === 0) return;
    if (searchText.trim() === "") return;

    //console.log("Searching for:", searchText);
    //console.log("Available sheetList:", sheetList);

    const examSheet = sheetList.find((item) =>
      item.Id_predict.includes(searchText.trim())
    );

    if (examSheet) {
      //console.log("Found matching sheet:", examSheet);
      fetchSpecificSheet(examSheet.Sheet_id);
    } else {
      //console.log("No match found for searchText");
    }
  }, [searchText, sheetList]);

  const columns = [
    {
      title: <div style={{ paddingLeft: "10px" }}>ข้อ</div>,
      dataIndex: "no",
      key: "no",
      render: (text) => (
        <div style={{ textAlign: "left", paddingLeft: "10px" }}>{text}</div>
      ),
    },
    {
      title: "คำตอบ",
      key: "Predict",
      render: (_, record) => {
        if (record.type === "6") {
          return null;
        }
        if (record.free === 1) {
          return <span>FREE</span>;
        }
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

        const handleInputChange = (id, value) => {
          if (value === "") {
            handleAnswerChange(id, ""); // อนุญาตให้ลบค่าทั้งหมด
            return;
          }

          const upperValue = value.toUpperCase(); // แปลงเป็นตัวพิมพ์ใหญ่ก่อนตรวจสอบ

          if (validateInput(record.type, upperValue)) {
            handleAnswerChange(id, upperValue);
          } else {
            handleAnswerChange(id, ""); // ถ้าค่าผิด ให้เคลียร์ Input
          }
        };

        const maxLength =
          record.type === "2"
            ? 2 // จำกัด 2 ตัวสำหรับ type 2
            : ["11", "12", "4", "51", "52"].includes(record.type)
            ? 1 // จำกัด 1 ตัวสำหรับ type 11, 12, 4, 51, 52
            : undefined; // อื่น ๆ ไม่จำกัด

        return (
          <div>
            {record.type === "3" ? (
              <textarea
                className="input-recheck-point textarea"
                value={editingAnswers[record.Ans_id] ?? record.Predict} // ใช้ค่าเดิมหรือค่าใหม่ที่ถูกแก้ไข
                onChange={(e) =>
                  handleInputChange(record.Ans_id, e.target.value)
                } // ตรวจสอบค่าก่อนเปลี่ยนแปลง
                onBlur={() => handleAnswerBlur(record.Ans_id)} // เรียกฟังก์ชันเมื่อออกจาก Input
              />
            ) : (
              <input
                className="input-recheck-point input"
                value={editingAnswers[record.Ans_id] ?? record.Predict} // ใช้ค่าเดิมหรือค่าใหม่ที่ถูกแก้ไข
                onChange={(e) =>
                  handleInputChange(record.Ans_id, e.target.value)
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
            <input
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

  const handleNextSheet = () => {
    if (currentIndex < sheetList.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      fetchSpecificSheet(sheetList[nextIndex].Sheet_id);

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
            className="custom-select responsive-custom-select-2"
            value={subjectId || undefined}
            onChange={(value) => setSubjectId(value)}
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
            className="custom-select responsive-custom-select-2"
            value={pageNo || undefined}
            onChange={(value) => {
              setPageNo(value);
              fetchExamSheets(value);
            }}
            placeholder="เลือกหน้ากระดาษคำตอบ..."
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
                  placeholder="StudentID..."
                />
              </div>
              <h1 className="label-recheck-table" style={{ color: "#1e497b" }}>
                Page: {pageNo !== null ? pageNo : "-"}
              </h1>
            </div>
            <div className="recheck-container-right">
              <div className="table-container">
                <Table
                  className="custom-table-recheck"
                  columns={columns}
                  dataSource={answerDetails.map((ans, index) => ({
                    key: `${ans.Ans_id}-${index}`,
                    ...ans,
                  }))}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: false,
                  }}
                  scroll={{ x: "max-content" }}
                  style={{ width: "100%" }}
                />
              </div>
              <h1 className="label-recheck-table" style={{ color: "#1e497b" }}>
                Total point:{" "}
                {examSheet &&
                examSheet.score !== null &&
                examSheet.score !== undefined
                  ? examSheet.score
                  : "ยังไม่มีข้อมูล"}
              </h1>
              {examSheet && examSheet.status === 1 && (
                <h1
                  className="label-recheck-table"
                  style={{ color: "#2aad2a" }}
                >
                  Status: OK
                </h1>
              )}
              <div className="recheck-button-container">
                <Button2
                  variant="primary"
                  size="custom"
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
