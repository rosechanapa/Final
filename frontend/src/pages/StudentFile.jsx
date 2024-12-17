import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../css/studentfile.css";
import { Card, Button, Select, Input, Space } from "antd";
import { AudioOutlined } from '@ant-design/icons';


const { Option } = Select;
const { Search } = Input;

const suffix = (
  <AudioOutlined
    style={{
      fontSize: 16,
      color: '#1677ff',
    }}
  />
);
const onSearch = (value, _e, info) => console.log(info?.source, value);

const StudentFile = () => {
  const [subjectId, setSubjectId] = useState("");
  const [subjectList, setSubjectList] = useState([]);

  // ฟังก์ชันสำหรับดึงข้อมูลวิชาจาก backend
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
      <h1 className="Title">คะแนนนักศึกษา</h1>

      <div className="input-group">
        <label className="label">รหัสวิชา:</label>
        <Select
          className="custom-select"
          value={subjectId || undefined}
          onChange={(value) => setSubjectId(value)}
          placeholder="กรุณาเลือกรหัสวิชา..."
          style={{ width: 300, height: 40 }}
        >
          {subjectList.map((subject) => (
            <Option key={subject.Subject_id} value={subject.Subject_id}>
              {subject.Subject_id} ({subject.Subject_name})
            </Option>
          ))}
        </Select>

        <Search
          className="custom-search"
          placeholder="ค้นหา รหัสนักศึกษา"
          allowClear
          onSearch={onSearch}
          style={{ width: 350 }}
        />
 
        <Button 
          type="primary"
          className="button_add"
          style={{ height: 40 }}
        >
          Add Student
        </Button>

        <Button 
          type="primary"
          className="button_export"
          style={{ height: 40 }}
        >
          Export CSV
        </Button>

      </div>


      <Card
        /*title="นักศึกษาทั้งหมด"*/
        
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
