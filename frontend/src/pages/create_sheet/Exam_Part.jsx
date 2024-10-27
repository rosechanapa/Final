import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "../../css/createExamsheet.css";
import { Card } from "antd";
import Button from "../../components/Button";

function Exam_Part() {
  const [subjectId, setSubjectId] = useState('');
  const [part, setPart] = useState('');
  const navigate = useNavigate();

  // useEffect เพื่อเรียก reset ทุกครั้งที่หน้าโหลด
  useEffect(() => {
    const resetData = async () => {
      await fetch('http://127.0.0.1:5000/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    };
    resetData();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    // ส่งข้อมูลไปยัง backend
    await fetch('http://127.0.0.1:5000/create_sheet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject_id: subjectId,
        part: part,
      }),
    });
    // ไปยังหน้าของ loop_part โดยส่งจำนวน part ไปด้วย 
    navigate('/loop_part', { state: { part: parseInt(part, 10) } });
  };

  return (
    <div>
      <h1 className="Title">สร้างกระดาษคำตอบ_New!</h1>
      <Card
        title="สร้างกระดาษคำตอบที่นี่ ( รองรับรูปแบบกระดาษ A4 ในแนวตั้งเท่านั้น )"
        className="card-edit"
        style={{
          width: "100%",
          height: 600,
          margin: "0 auto",
        }}
      >
        <form onSubmit={handleSubmit}>
          <div className="input-container">
            <div className="input-group">
              <label className="label">รหัสวิชา:</label>
              <input
                className="input-box"
                type="text"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="label">จำนวน Part:</label>
              <input
                className="input-box"
                type="text"
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
        </form>
      </Card>
    </div>
  );
}

export default Exam_Part;
