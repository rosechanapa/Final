import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../css/createExamsheet.css";
import { Card, Select, Modal } from "antd";
import Button from "../../components/Button";
import { useLocation } from "react-router-dom";

const { Option } = Select;
function ExamPart() {
  const { state } = useLocation();
  const [subjectId, setSubjectId] = useState(state?.subjectId || "");
  const [subjectList, setSubjectList] = useState([]);
  const [page_number, setPage] = useState("");
  const [part, setPart] = useState("");
  const [pageError, setPageError] = useState(false); // สำหรับเลขหน้า
  const [partError, setPartError] = useState(false); // สำหรับจำนวนตอน
  const [isPageValid, setIsPageValid] = useState(true); // ตรวจสอบความถูกต้องของ page_number
  const [isPartValid, setIsPartValid] = useState(true);
  const navigate = useNavigate();

  ///////---------สำหรับเขียนดักอักขระพิเศษ--------------
  const handlePageChange = (e) => {
    const value = e.target.value;
    setPage(value);
    const isValid = /^\d*$/.test(value);
    setIsPageValid(isValid);
    setPageError(!isValid);
  };

  const handlePartChange = (e) => {
    const value = e.target.value;
    setPart(value);
    const isValid = /^\d*$/.test(value);
    setIsPartValid(isValid);
    setPartError(!isValid);
  };
  // ฟังก์ชันสำหรับดึงข้อมูลวิชาจาก backend
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

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isPageValid || !isPartValid || !page_number || !part) {
      if (!page_number) setIsPageValid(false);
      if (!part) setIsPartValid(false);
      return;
    }
    try {
      const response = await fetch("http://127.0.0.1:5000/check_subject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject_id: subjectId }),
      });
      const data = await response.json();

      if (data.exists) {
        Modal.confirm({
          title: "กระดาษคำตอบสำหรับวิชานี้เคยสร้างไปแล้ว",
          width: 550,
          className: "custom-modal",
          content:
            "หากคุณต้องการสร้างกระดาษคำตอบวิชานี้ใหม่ ข้อมูลเฉลยและกระดาษคำตอบที่เคยมีอยู่ของวิชานี้จะถูกลบทั้งหมด ",
          onOk: async () => {
            try {
              // เรียก API /reset โดยไม่ต้องส่ง subject_id
              await fetch(`http://127.0.0.1:5000/reset/${subjectId}`, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                },
              });

              // เรียก API /create_sheet หลังจาก reset เสร็จ
              await fetch("http://127.0.0.1:5000/create_sheet", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  subject_id: subjectId,
                  part: parseInt(part, 10),
                  page_number: parseInt(page_number, 10),
                }),
              });

              navigate("/LoopPart", {
                state: { part: parseInt(part, 10), subjectId: subjectId },
              });
            } catch (error) {
              console.error("Error resetting data:", error);
            }
          },
          onCancel: () => {
            console.log("การรีเซ็ตถูกยกเลิก");
          },
        });
      } else {
        console.log("ไม่มีข้อมูลสำหรับ Subject_id นี้ในตาราง Page");
        await fetch("http://127.0.0.1:5000/create_sheet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subject_id: subjectId,
            part: parseInt(part, 10),
            page_number: parseInt(page_number, 10),
          }),
        });
        navigate("/LoopPart", {
          state: { part: parseInt(part, 10), subjectId: subjectId },
        });
      }
    } catch (error) {
      console.error("Error checking subject:", error);
    }
  };
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      handleSubmit(event); // เรียก handleSubmit เมื่อกด Enter
    }
  };
  return (
    <div>
      <h1 className="Title">สร้างกระดาษคำตอบ</h1>
      <Card
        title={
          <span style={{ fontSize: "14px" }}>
            สร้างกระดาษคำตอบที่นี่ ( รองรับรูปแบบกระดาษ A4 ในแนวตั้งเท่านั้น )
          </span>
        }
        className="card-edit"
        style={{
          width: "100%",
          height: 600,
          margin: "0 auto",
        }}
      >
        <div className="input-container" onKeyDown={handleKeyDown} tabIndex={0}>
          <div className="input-group">
            <label className="label">รหัสวิชา:</label>
            <Select
              className="custom-select"
              value={subjectId || undefined}
              onChange={(value) => setSubjectId(value)}
              placeholder="กรุณาเลือกรหัสวิชา..."
              style={{ width: 320, height: 35 }}
            >
              {subjectList.map((subject) => (
                <Option key={subject.Subject_id} value={subject.Subject_id}>
                  {subject.Subject_id} ({subject.Subject_name})
                </Option>
              ))}
            </Select>
          </div>
          <div className="input-group">
            <label className="label">เลขหน้าเริ่มต้น:</label>
            {pageError && (
              <p className="msg-error" style={{ top: "200px" }}>
                *ใส่ตัวเลขเท่านั้น
              </p>
            )}
            <input
              className={`input-box ${!isPageValid ? "error" : ""}`}
              style={{ width: "320px", height: "35px" }}
              type="text"
              placeholder="ระบุเลขหน้าเริ่มต้น..."
              value={page_number}
              min="0"
              onChange={handlePageChange}
            />
          </div>
          <div className="input-group">
            <label className="label">จำนวนตอน:</label>
            {partError && (
              <p className="msg-error" style={{ top: "290px" }}>
                *ใส่ตัวเลขเท่านั้น
              </p>
            )}
            <input
              className={`input-box ${!isPartValid ? "error" : ""}`}
              style={{ width: "320px", height: "35px" }}
              type="text"
              placeholder="ระบุจำนวนตอน..."
              value={part}
              min="0"
              onChange={handlePartChange}
            />
          </div>
        </div>
        <div className="Button-container">
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={!isPageValid || !isPartValid || !page_number || !part}
          >
            ถัดไป
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default ExamPart;