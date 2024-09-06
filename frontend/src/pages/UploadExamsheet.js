import React from "react";
import "../css/uploadExamsheet.css";
import { Card } from "antd";
const UploadExamsheet = () => {
  return (
    <div>
      <h1 className="Title">อัปโหลดกระดาษคำตอบ</h1>
      <Card
        title="อัปโหลดไฟล์กระดาษคำตอบที่ต้องการให้ระบบช่วยตรวจ"
        className="card-edit"
        style={{
          width: "100%",
          height: 600,
          margin: "0 auto",
        }}
      >
        <p>Card content</p>
      </Card>
    </div>
  );
};

export default UploadExamsheet;
