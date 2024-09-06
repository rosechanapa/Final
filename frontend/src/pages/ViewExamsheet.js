import React from "react";
import "../css/viewExamsheet.css";
import { Card } from "antd";
const ViewExamsheet = () => {
  return (
    <div>
      <h1 className="Title">กระดาษคำตอบทั้งหมด</h1>
      <Card
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

export default ViewExamsheet;
