import React, { useState } from 'react';
import "../../css/createExamsheet.css";
import { Card } from "antd";
import Button from "../../components/Button";

function InitialPage({ onSubmit }) {
  const [subjectId, setSubjectId] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [startNumber, setStartNumber] = useState('');


  const handleSubmit = async (event) => {
    event.preventDefault();

    const response = await fetch('http://127.0.0.1:5000/create_paper', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        subject_id: subjectId, 
        page_number: pageNumber, 
        start_number: startNumber 
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const imageSrc = `data:image/png;base64,${data.image}`;
      onSubmit(subjectId, pageNumber, startNumber, imageSrc); // ส่งภาพ A กลับไปด้วย
    } else {
      console.error('Failed to create paper');
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
        <form onSubmit={handleSubmit}>
          <div className="input-container">
            <div className="input-group">
              <h1 className="label">รหัสวิชา: </h1>
              <input
                className="input-box"
                type="text"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              />
            </div>

            <div className="input-group">
              <h1 className="label">หน้าที่: </h1>
              <input
                className="input-box"
                type="text"
                value={pageNumber}
                onChange={(e) => setPageNumber(e.target.value)}
              />
            </div>

            <div className="input-group">
              <h1 className="label">เลขข้อเริ่มต้น: </h1>
              <input
                className="input-box"
                type="text"
                value={startNumber}
                onChange={(e) => setStartNumber(e.target.value)}
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

export default InitialPage;
