import React, { useState, useEffect } from "react";
import "../css/editlabel.css";
import { Table, Select, Input, message, Typography, Checkbox } from "antd";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import axios from "axios";
import Button from "../components/Button";

const { Option } = Select;
const { Title } = Typography;

const EditLabel = () => {
  const [dataSource, setDataSource] = useState([]);
  const [subjectList, setSubjectList] = useState([]); // รายชื่อวิชา
  const [subjectId, setSubjectId] = useState(""); // วิชาที่เลือก
  const [editingAnswers, setEditingAnswers] = useState({}); // เก็บค่า input ของแต่ละแถว
  const [editingKey, setEditingKey] = useState(null); // เก็บ label_id ที่กำลังแก้ไข
  const [editingRow, setEditingRow] = useState({}); // เก็บข้อมูลของแถวที่กำลังแก้ไข

  // ดึงข้อมูลวิชาทั้งหมด
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:5000/get_subjects");
        const subjects = response.data;
        setSubjectList(subjects);
  
        // ตั้งค่า subjectId เป็น Subject_id แรกที่เจอในรายการ
        if (subjects.length > 0) {
          const firstSubjectId = subjects[0].Subject_id;
          setSubjectId(firstSubjectId);
  
          // ดึงข้อมูล labels สำหรับวิชาแรก
          fetchLabels(firstSubjectId);
        }
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

  const handleCheckboxChange = async (labelId, value) => {
    if (!value) {
      console.warn("No value selected for handleCheckboxChange");
      return;
    }
  
    try {
      const response = await axios.put(`http://127.0.0.1:5000/update_label/${labelId}`, {
        Answer: value, // ส่งค่าเดียว
      });
  
      if (response.data.status === "success") {
        message.success("Answer updated successfully");
  
        // อัปเดต DataSource
        setDataSource((prevData) =>
          prevData.map((item) =>
            item.Label_id === labelId ? { ...item, Answer: value } : item
          )
        );
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error updating answer:", error);
      message.error("Failed to update answer");
    }
  };  
  
 
  // ฟังก์ชันส่งข้อมูลเมื่อกดออกจาก input
  const handleAnswerChange = (labelId, value) => {
    if (value === undefined || value === null) {
      console.warn("Received undefined or null value for handleAnswerChange");
      return;
    }
    setEditingAnswers((prev) => ({
      ...prev,
      [labelId]: value,
    }));
  };  
  
  const handleAnswerBlur = async (labelId) => {
    const value = editingAnswers[labelId];
    if (!value) return; // ถ้าไม่มีการเปลี่ยนแปลงค่า ไม่ต้องส่ง request
  
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

  const handleEdit = (record) => {
    setEditingKey(record.Label_id); // เก็บ `Label_id` ของแถวที่ต้องการแก้ไข
    setEditingRow({ ...record }); // เก็บข้อมูลของแถวที่ต้องการแก้ไข
  };

  const handleSaveEdit = async () => {
    try {
      const response = await axios.put(`http://127.0.0.1:5000/update_point/${editingRow.Label_id}`, {
        label_id: editingRow.Label_id,
        point: editingRow.Point_single ? parseFloat(editingRow.Point_single) : 0,
      });
  
      if (response.data.status === "success") {
        message.success("บันทึกคะแนนสำเร็จ");
        setEditingKey(null); // ปิดการแก้ไข
        // เรียกฟังก์ชัน fetchLabels เพื่อดึงข้อมูลใหม่
        await fetchLabels(subjectId);
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error updating score:", error);
      message.error("บันทึกคะแนนไม่สำเร็จ");
    }
  };
  

  // คอลัมน์สำหรับแสดงผล
  const columns = [
    {
      title: <div style={{ paddingLeft: "20px" }}>ข้อที่</div>,
      dataIndex: "No",
      key: "No",
    },
    {
      title: "เฉลย",
      dataIndex: "Answer",
      key: "Answer",
      render: (text, record) => {
        switch (record.Type) {
          case '11':
            return (
              <>
                <Input.OTP
                  length={1}
                  syntax="number"
                  value={editingAnswers[record.Label_id] ?? text}
                  onChange={(value) => {
                    console.log("Value:", value);
                    handleAnswerChange(record.Label_id, value);
                  }}     
                  onBlur={() => handleAnswerBlur(record.Label_id)}
                  style={{
                    width: "35px", // ความกว้าง
                    height: "50px", // ความสูง
                  }}
                />
              </>
            );
          case '12':
            return (
              <>
                <Input.OTP
                  length={1}
                  syntax="char"
                  value={editingAnswers[record.Label_id] ?? text}
                  onChange={(value) => {
                    console.log("Value:", value);
                    handleAnswerChange(record.Label_id, value);
                  }}     
                  onBlur={() => handleAnswerBlur(record.Label_id)}
                  style={{
                    width: "35px", // ความกว้าง
                    height: "50px", // ความสูง
                  }}
                />
              </>
            );
          case '2':
            return (
              <>
                <Input.OTP
                  length={2}
                  syntax="number"
                  value={editingAnswers[record.Label_id] ?? text}
                  onChange={(value) => {
                    console.log("Value:", value);
                    handleAnswerChange(record.Label_id, value);
                  }}                  
                  onBlur={() => handleAnswerBlur(record.Label_id)}
                  style={{
                    width: "100px", // กำหนดความกว้าง
                    height: "50px", // กำหนดความสูง
                  }}
                />
              </>
            );
          case '4':
            return (
              <>
                <Input.OTP
                  length={1}
                  syntax="T or F"
                  value={editingAnswers[record.Label_id] ?? text}
                  onChange={(value) => {
                    console.log("Value:", value);
                    handleAnswerChange(record.Label_id, value);
                  }}     
                  onBlur={() => handleAnswerBlur(record.Label_id)}
                  style={{
                    width: "35px", // ความกว้าง
                    height: "50px", // ความสูง
                  }}
                />
              </>
            );
          case '51':
            return (
              <>
                <Checkbox.Group
                  options={[
                    { label: 'A', value: 'A' },
                    { label: 'B', value: 'B' },
                    { label: 'C', value: 'C' },
                    { label: 'D', value: 'D' },
                  ]}
                  value={editingAnswers[record.Label_id] ? [editingAnswers[record.Label_id]] : [text]} // ค่าเริ่มต้นจากฐานข้อมูล
                  onChange={(checkedValues) => {
                    const selectedValue = checkedValues.pop(); // ดึงค่าเลือกล่าสุด
                    console.log("Selected Value:", selectedValue);
                    handleCheckboxChange(record.Label_id, selectedValue); // ส่งค่าเดียว
                  }}
                />
              </>
            );
          
          case '52':
            return (
              <>
                <Checkbox.Group
                  options={[
                    { label: 'A', value: 'A' },
                    { label: 'B', value: 'B' },
                    { label: 'C', value: 'C' },
                    { label: 'D', value: 'D' },
                    { label: 'E', value: 'E' },
                  ]}
                  value={editingAnswers[record.Label_id] ? [editingAnswers[record.Label_id]] : [text]} // ค่าเริ่มต้นจากฐานข้อมูล
                  onChange={(checkedValues) => {
                    const selectedValue = checkedValues.pop(); // ดึงค่าเลือกล่าสุด
                    console.log("Selected Value:", selectedValue);
                    handleCheckboxChange(record.Label_id, selectedValue); // ส่งค่าเดียว
                  }}
                />
              </>
            );            
          default:
            return (
              <Input
                value={editingAnswers[record.Label_id] ?? text} // ใช้ค่าใน state ถ้ามีการแก้ไข
                onChange={(e) => handleAnswerChange(record.Label_id, e.target.value)}
                onBlur={() => handleAnswerBlur(record.Label_id)}
                placeholder="ใส่เฉลย..."
              />
            );
        }
      },
    },        
    {
      title: "คะแนน",
      key: "Points",
      render: (text, record) => {
        // แสดงคะแนนเฉพาะแถวที่ Group_Label ไม่ใช่ ""
        if (record.Group_Label !== "") {
          if (editingKey === record.Label_id) {
            return (
              <Input
                type="number"
                value={editingRow.Point_single ?? ""}
                onChange={(e) =>
                  setEditingRow({ ...editingRow, Point_single: e.target.value })
                }
                placeholder="ใส่คะแนน..."
              />
            );
          }
          const points = record.Point_Group ?? record.Point_single;
          return points !== null ? parseFloat(points).toFixed(2) : "ยังไม่มีข้อมูล";
        }
        return null; // ไม่แสดงอะไรเลยหาก Group_Label เป็น ""
      },
    },
    {
      title: "ประเภท",
      dataIndex: "Group_Label",
      key: "Type",
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => {
        // แสดงปุ่มเฉพาะแถวที่ Group_Label ไม่ใช่ ""
        if (record.Group_Label !== "") {
          return editingKey === record.Label_id ? (
            <Button size="edit" varian="primary" onClick={handleSaveEdit}>
              <SaveIcon />
            </Button>
          ) : (
            <Button
              size="edit"
              varian="primary"
              onClick={() => handleEdit(record)}
            >
              <EditIcon />
            </Button>
          );
        }
        return null; // ไม่แสดงอะไรเลยหาก Group_Label เป็น ""
      },
    }
    
  ];

  return (
    <div>
      <h1 className="Title">จัดการเฉลยข้อสอบ</h1>
      <div className="input-group-std">
        <div className="dropdown-group">
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
        </div>
      </div>

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