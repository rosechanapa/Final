import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../css/createExamsheet.css";
import { Card } from "antd";
import Button from "../../components/Button";

function ExamPart() {
  const [subjectId, setSubjectId] = useState("");
  const [page_number, setPage] = useState("");
  const [part, setPart] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    // ส่งข้อมูลไปยัง backend
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
    // ไปยังหน้าของ loop_part โดยส่งจำนวน part ไปด้วย
    navigate("/LoopPart", { state: { part: parseInt(part, 10) } });
  };

  return (
    <div>
      <h1 className="Title">สร้างกระดาษคำตอบ</h1>
      <Card
        title="สร้างกระดาษคำตอบที่นี่ ( รองรับรูปแบบกระดาษ A100 ในแนวตั้งเท่านั้น )"
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
            <input
              className="input-box"
              type="text"
              placeholder="ระบุรหัสวิชา..."
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="label">เลขหน้าเริ่มต้น:</label>
            <input
              className="input-box"
              type="text"
              placeholder="ระบุเลขหน้าเริ่มต้น..."
              value={page_number}
              onChange={(e) => setPage(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="label">จำนวน Part:</label>
            <input
              className="input-box"
              type="text"
              placeholder="ระบุจำนวน Part..."
              value={part}
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
