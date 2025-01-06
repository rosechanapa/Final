import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../css/createExamsheet.css";
import { Card, Select, Modal } from "antd";
import Button from "../../components/Button";

const { Option } = Select;
function ExamPart() {
  const [subjectId, setSubjectId] = useState("");
  const [subjectList, setSubjectList] = useState([]);
  const [page_number, setPage] = useState("");
  const [part, setPart] = useState("");
  const navigate = useNavigate();
 

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
        title: "ยืนยันการสร้างกระดาษสำหรับวิชานี้ใหม่",
        content: "ข้อมูลเฉลยและกระดาษที่มีอยู่ของวิชานี้จะถูกลบทั้งหมด ต้องการดำเนินสร้างกระดาษใหม่ทั้งหมดหรือไม่?",
        onOk: async () => {
          try {
            // เรียก API /reset โดยไม่ต้องส่ง subject_id
            await fetch("http://127.0.0.1:5000/reset", {
              method: "POST",
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

            navigate("/LoopPart", { state: { part: parseInt(part, 10) } });

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
      navigate("/LoopPart", { state: { part: parseInt(part, 10) } });
    }
  } catch (error) {
    console.error("Error checking subject:", error);
  }
};


  return (
    <div>
      <h1 className="Title">สร้างกระดาษคำตอบ</h1>
      <Card
        title="สร้างกระดาษคำตอบที่นี่ ( รองรับรูปแบบกระดาษ A4 ในแนวตั้งเท่านั้น )"
        className="card-edit"
        style={{
          width: "100%",
          height: 600,
          margin: "0 auto",
        }}
      >
        <div className="input-container">
          <div className="input-group">
            <label className="label">รหัสวิชา:</label>
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
          <div className="input-group">
            <label className="label">เลขหน้าเริ่มต้น:</label>
            <input
              className="input-box"
              type="text"
              placeholder="ระบุเลขหน้าเริ่มต้น..."
              value={page_number}
              min="0"
              onChange={(e) => setPage(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="label">จำนวนตอน:</label>
            <input
              className="input-box"
              type="text"
              placeholder="ระบุจำนวนตอน..."
              value={part}
              min="0"
              onChange={(e) => setPart(e.target.value)}
            />
          </div>
        </div>
        <div className="Button-container">
          <Button variant="primary" size="md" onClick={handleSubmit}>
            ถัดไป
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default ExamPart;
