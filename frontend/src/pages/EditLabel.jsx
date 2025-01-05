import React, { useState, useEffect } from "react";
import "../css/editlabel.css";
import { Table, Select, Input, message } from "antd";
import axios from "axios";

const { Option } = Select;

const EditLabel = () => {
  const [dataSource, setDataSource] = useState([]);
  const [subjectList, setSubjectList] = useState([]); // รายชื่อวิชา
  const [subjectId, setSubjectId] = useState(""); // วิชาที่เลือก
  const [editingAnswers, setEditingAnswers] = useState({}); // เก็บค่า input ของแต่ละแถว

  // ดึงข้อมูลวิชาทั้งหมด
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:5000/get_subjects");
        setSubjectList(response.data);
      } catch (error) {
        console.error("Error fetching subjects:", error);
      }
    };
    fetchSubjects();
  }, []);

  // ดึงข้อมูล label เมื่อเลือกวิชา
  const fetchLabels = async (subjectId) => {
    try {
      const response = await axios.get(`http://127.0.0.1:5000/get_labels/${subjectId}`);
      if (response.data.status === "success") {
        const groupedData = mergeGroupRows(response.data.data); // จัดกลุ่มข้อมูลก่อนแสดง
        setDataSource(groupedData);
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error fetching labels:", error);
      message.error("Failed to fetch labels");
    }
  };

  // เมื่อเลือกวิชา
  const handleSubjectChange = (value) => {
    setSubjectId(value);
    fetchLabels(value); // เรียก API
  };

  // ฟังก์ชันจัดกลุ่มข้อมูล
  const mergeGroupRows = (data) => {
    let groupCounter = 1;
    const groupMap = new Map();
    return data.map((item) => {
      if (item.Group_No !== null) {
        if (!groupMap.has(item.Group_No)) {
          groupMap.set(item.Group_No, `Group ${groupCounter}`);
          groupCounter++;
          return { ...item, Group_Label: groupMap.get(item.Group_No) };
        }
        return { ...item, Group_Label: "" }; // แสดงว่างสำหรับแถวในกลุ่มเดียวกัน
      }
      return { ...item, Group_Label: "Single" }; // สำหรับข้อที่ไม่มี Group
    });
  };

  // ฟังก์ชันส่งข้อมูลการแก้ไข Answer ไปที่ Back-end
  const handleAnswerChange = (labelId, value) => {
    setEditingAnswers((prev) => ({
      ...prev,
      [labelId]: value,
    }));
  };

  // ฟังก์ชันส่งข้อมูลเมื่อกดออกจาก input
  const handleAnswerBlur = async (labelId) => {
    const value = editingAnswers[labelId];
    if (value === undefined) return; // ถ้าไม่มีการเปลี่ยนแปลงค่า ไม่ต้องส่ง request

    try {
      const response = await axios.put(`http://127.0.0.1:5000/update_label/${labelId}`, {
        Answer: value,
      });
      if (response.data.status === "success") {
        message.success("Answer updated successfully");
        setDataSource((prevData) =>
          prevData.map((item) =>
            item.Label_id === labelId ? { ...item, Answer: value } : item
          )
        );
        setEditingAnswers((prev) => {
          const newState = { ...prev };
          delete newState[labelId]; // ลบค่าออกจาก state หลังจากบันทึกสำเร็จ
          return newState;
        });
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error updating answer:", error);
      message.error("Failed to update answer");
    }
  };

  // คอลัมน์สำหรับแสดงผล
  const columns = [
    {
      title: "ข้อที่",
      dataIndex: "No",
      key: "No",
    },
    {
      title: "เฉลย",
      dataIndex: "Answer",
      key: "Answer",
      render: (text, record) => (
        <Input
          value={editingAnswers[record.Label_id] ?? text} // ใช้ค่าใน state ถ้ามีการแก้ไข
          onChange={(e) => handleAnswerChange(record.Label_id, e.target.value)}
          onBlur={() => handleAnswerBlur(record.Label_id)}
          placeholder="ใส่เฉลย..."
        />
      ),
    },
    {
      title: "คะแนน",
      key: "Points",
      render: (text, record) => {
        const points = record.Point_Group ?? record.Point_single;
        return points !== null ? parseFloat(points).toFixed(2) : "ยังไม่มีข้อมูล";
      },
    },
    {
      title: "ประเภท",
      dataIndex: "Group_Label",
      key: "Type",
    },
  ];

  return (
    <div>
      <h1>จัดการเฉลยข้อสอบ</h1>
      <Select
        value={subjectId || undefined}
        onChange={handleSubjectChange}
        placeholder="เลือกวิชา"
        style={{ width: 300 }}
      >
        {subjectList.map((subject) => (
          <Option key={subject.Subject_id} value={subject.Subject_id}>
            {subject.Subject_name} ({subject.Subject_id})
          </Option>
        ))}
      </Select>

      <Table
        dataSource={dataSource}
        columns={columns}
        rowKey="Label_id" // ใช้ Label_id เป็นคีย์
        pagination={{ pageSize: 10 }}
        className="custom-table"
      />
    </div>
  );
};

export default EditLabel;
