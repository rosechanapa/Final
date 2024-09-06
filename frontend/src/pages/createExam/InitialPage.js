import React, { useState } from 'react';
import "../../css/createExamsheet.css";
import { Card } from "antd";

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
      body: JSON.stringify({ subject_id: subjectId, page_number: pageNumber, start_number: startNumber }),
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
      <h1 className="Title">Create Exampaper</h1>
      <Card
        title="สร้างกระดาษคำตอบ"
        className="card-edit"
        style={{
          width: '100%',
          height: 600,
          margin: '0 auto', // จัดกึ่งกลาง
        }}
      >
        <form onSubmit={handleSubmit}>
          <div className="input_page1">
            <label>รหัสวิชา: </label>
            <input
              type="text"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            />
          </div>
          <div className="input_page1">
            <label>หน้าที่: </label>
            <input
              type="text"
              value={pageNumber}
              onChange={(e) => setPageNumber(e.target.value)}
            />
          </div>
          <div className="input_page1">
            <label>เลขข้อเริ่มต้น: </label>
            <input
              type="text"
              value={startNumber}
              onChange={(e) => setStartNumber(e.target.value)}
            />
          </div>
          <button type="submit" className="next">ถัดไป</button>
        </form>
      </Card>
    </div>
  );
}

export default InitialPage;
