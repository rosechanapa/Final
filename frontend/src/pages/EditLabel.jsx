import React, { useState, useEffect } from "react";
import "../css/editlabel.css";
import { Table, Select, message } from "antd";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import axios from "axios";
import Button from "../components/Button";

const { Option } = Select;

const EditLabel = () => {
  const [dataSource, setDataSource] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [editingAnswers, setEditingAnswers] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [editingRow, setEditingRow] = useState({});

  // ดึงข้อมูลวิชาทั้งหมด
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:5000/get_subjects");
        const subjects = response.data;
        setSubjectList(subjects);

        if (subjects.length > 0) {
          const firstSubjectId = subjects[0].Subject_id;
          setSubjectId(firstSubjectId);
          fetchLabels(firstSubjectId);
        }
      } catch (error) {
        console.error("Error fetching subjects:", error);
      }
    };
    fetchSubjects();
  }, []);

  const fetchLabels = async (subjectId) => {
    try {
      const response = await axios.get(
        `http://127.0.0.1:5000/get_labels/${subjectId}`
      );
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

  const handleSubjectChange = (value) => {
    setSubjectId(value);
    fetchLabels(value); // เรียก API
  };

  const mergeGroupRows = (data) => {
    let groupCounter = 1;
    const groupMap = new Map();
    return data.map((item) => {
      if (item.Group_no !== null) {
        if (!groupMap.has(item.Group_no)) {
          groupMap.set(item.Group_no, `Group ${groupCounter}`);
          groupCounter++;

          return { ...item, Group_Label: groupMap.get(item.Group_no) };
        }
        return { ...item, Group_Label: "" }; // แสดงว่างสำหรับแถวในกลุ่มเดียวกัน
      }
      return { ...item, Group_Label: "Single" }; // สำหรับข้อที่ไม่มี Group
    });
  };

  // ฟังก์ชันส่งข้อมูลเมื่อกดออกจาก input
  const handleAnswerChange = (labelId, value) => {
    setEditingAnswers((prev) => ({
      ...prev,
      [labelId]: value,
    }));
  };

  const handleAnswerBlur = async (labelId) => {
    const value = editingAnswers[labelId];
    if (value === undefined) return; // ถ้าไม่มีการเปลี่ยนแปลงค่า ไม่ต้องส่ง request

    try {
      const response = await axios.put(
        `http://127.0.0.1:5000/update_label/${labelId}`,
        {
          Answer: value,
        }
      );
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
      const response = await axios.put(
        `http://127.0.0.1:5000/update_point/${editingRow.Label_id}`,
        {
          label_id: editingRow.Label_id,
          point: editingRow.Point_single
            ? parseFloat(editingRow.Point_single)
            : 0,
        }
      );

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

  const columns = [
    {
      title: <div style={{ paddingLeft: "20px" }}>ข้อที่</div>,
      dataIndex: "No",
      key: "No",
      width: 100,
      render: (text) => <div style={{ paddingLeft: "20px" }}>{text}</div>,
    },
    {
      title: "เฉลย",
      dataIndex: "Answer",
      key: "Answer",
      width: 150,
      render: (text, record) => (
        <input
          className="input-box-label"
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
      width: 120,
      render: (text, record) => {
        // แสดงคะแนนเฉพาะแถวที่ Group_Label ไม่ใช่ ""
        if (record.Group_Label !== "") {
          if (editingKey === record.Label_id) {
            return (
              <input
                className="input-box-score"
                type="number"
                value={editingRow.Point_single ?? ""}
                onChange={(e) =>
                  setEditingRow({ ...editingRow, Point_single: e.target.value })
                }
                placeholder="ใส่คะแนน..."
              />
            );
          }
          const points = record.Point_group ?? record.Point_single;
          return points !== null
            ? parseFloat(points).toFixed(2)
            : "ยังไม่มีข้อมูล";
        }
        return null;
      },
    },

    {
      title: "ประเภท",
      dataIndex: "Group_Label",
      key: "Type",
      width: 120,
    },
    {
      title: "Action",
      key: "action",
      width: 100,
      render: (_, record) => {
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
        return null;
      },
    },
  ];

  return (
    <div>
      <h1 className="Title">เฉลยของข้อสอบทั้งหมด</h1>
      <div className="input-group-std">
        <div className="dropdown-group">
          <Select
            className="custom-select-std"
            value={subjectId || undefined}
            onChange={handleSubjectChange}
            placeholder="เลือกวิชา..."
            style={{ width: 340, height: 40 }}
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
        rowKey="Label_id"
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
        }}
        className="custom-table"
      />
    </div>
  );
};

export default EditLabel;
