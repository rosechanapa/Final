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
          width: '100%',
          height: 600,
          margin: '0 auto', // จัดกึ่งกลาง
        }}
      >
        <p>Card content</p>
      </Card>
    </div>
  );
};

export default UploadExamsheet;
