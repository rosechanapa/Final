import React from "react";
import "../css/studentfile.css";
import { Card } from "antd";
const StudentFile = () => {
  return (
    <div>
      <h1 className="Title">Student</h1>
      <Card
        title="นักศึกษาทั้งหมด"
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

export default StudentFile;
