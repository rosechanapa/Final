import React from "react";
import "../css/uploadExamsheet.css";
import { Card } from "antd";
const UploadExamsheet = () => {
  return (
    <div>
      <h1 className="Title">Upload Examsheet</h1>
      <Card
        title="อัปโหลดไฟล์กระดาษคำตอบที่ต้องการให้ระบบช่วยตรวจ"
        className="card-edit"
        style={{
          width: 1400,
          height: 600,
        }}
      >
        <p>Card content</p>
      </Card>
    </div>
  );
};

export default UploadExamsheet;
