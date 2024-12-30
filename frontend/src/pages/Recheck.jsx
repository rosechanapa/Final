import React, { useState, useEffect } from "react";
import "../css/recheck.css";
import { Card, Select } from "antd";

const { Option } = Select;
const Recheck = () => {
  //  const [subjectId, setSubjectId] = useState("");

  const [subjectList, setSubjectList] = useState([]);

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

  return (
    <div>
      <h1 className="Title">Recheck</h1>
      <div className="input-group-std">
        <div className="dropdown-group">
          <label className="label-std">วิชา: </label>
          <Select
            className="custom-select-std"
            placeholder="เลือกวิชา..."
            style={{ width: 300, height: 40 }}
          >
            {subjectList.map((subject) => (
              <Option key={subject.Subject_id} value={subject.Subject_id}>
                {subject.Subject_id} ({subject.Subject_name})
              </Option>
            ))}
          </Select>
        </div>

        <div className="dropdown-group">
          <label className="label-std">เลขหน้า: </label>
          <Select
            className="custom-select-std"
            placeholder="เลือกเลขหน้า..."
            style={{ width: 250, height: 40 }}
          >
            {subjectList.map((subject) => (
              <Option key={subject.Subject_id} value={subject.Subject_id}>
                {subject.Subject_id} ({subject.Subject_name})
              </Option>
            ))}
          </Select>
        </div>
      </div>
      <Card
        className="card-edit"
        style={{
          width: "100%",
          height: 600,
          margin: "0 auto", // จัดกึ่งกลาง
        }}
      >
        <p>Card content</p>
      </Card>
    </div>
  );
};

export default Recheck;
