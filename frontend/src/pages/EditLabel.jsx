import React, { useState, useEffect, useRef } from "react";
import "../css/editlabel.css";
import { Table, Input, Select, message } from "antd";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import axios from "axios";
import Button from "../components/Button";

const { Option } = Select;

const EditLabel = () => {
  const [dataSource, setDataSource] = useState([]);
  const [editingKey, setEditingKey] = useState(null);
  const [editingRow, setEditingRow] = useState({});
  const [subjectList, setSubjectList] = useState([]); // List of subjects
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectId, setSubjectId] = useState("");
  const displayedGroups = useRef(new Set());

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

  const handleSubjectChange = (value) => {
    setSubjectId(value);
    setSelectedSubject(value);
  };

  useEffect(() => {
    if (selectedSubject) {
      fetchLabels(selectedSubject);
    }
  }, [selectedSubject]);

  const fetchLabels = async (subjectId) => {
    try {
      const response = await axios.get(
        `http://127.0.0.1:5000/get_labels/${subjectId}`
      );
      console.log("API Response:", response.data);
      if (response.data.status === "success") {
        const groupedData = mergeGroupRows(response.data.data);
        console.log("Fetched Data:", response.data.data); // ตรวจสอบข้อมูลก่อนจัดกลุ่ม
        console.log("Grouped Data:", groupedData); // ตรวจสอบข้อมูลหลังจัดกลุ่ม
        setDataSource(groupedData);
        displayedGroups.current.clear();
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error fetching labels:", error);
      message.error("Failed to fetch labels");
    }
  };

  const handleEdit = (record) => {
    setEditingKey(record.Label_id);
    setEditingRow({ ...record });
  };

  const handleSaveEdit = async () => {
    try {
      const response = await axios.put(
        `http://127.0.0.1:5000/update_label/${editingRow.Label_id}`,
        {
          Answer: editingRow.Answer,
          Point_single: editingRow.Point_single
            ? parseFloat(editingRow.Point_single).toFixed(2)
            : null,
        }
      );
      if (response.data.status === "success") {
        message.success("Label updated successfully");

        const updatedData = dataSource.map((item) =>
          item.Label_id === editingRow.Label_id
            ? { ...item, ...editingRow }
            : item
        );
        setDataSource(updatedData);
        setEditingKey(null);
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error updating label:", error);
      message.error("Failed to update label");
    }
  };

  const mergeGroupRows = (data) => {
    const groupedData = [];
    const groupSet = new Set();

    data.forEach((item) => {
      if (item.Group_No) {
        if (!groupSet.has(item.Group_No)) {
          // แสดงคะแนนเฉพาะแถวแรกของ Group_No
          groupedData.push({
            ...item,
            isGroup: true, // ระบุว่าเป็น group
          });
          groupSet.add(item.Group_No);
        } else {
          // แถวอื่นใน Group_No แต่เว้นคะแนนว่าง
          groupedData.push({
            ...item,
            Point_Group: null, // เว้นคะแนนในแถวอื่นของกลุ่ม
            isGroup: true,
          });
        }
      } else {
        groupedData.push({
          ...item,
          isGroup: false, // ระบุว่าเป็น single point
        });
      }
    });

    return groupedData;
  };

  const columns = [
    {
      title: <div style={{ paddingLeft: "20px" }}>ข้อที่</div>,
      dataIndex: "No",
      key: "No",
      render: (text) => <div style={{ paddingLeft: "20px" }}>{text}</div>,
    },
    {
      title: "เฉลย",
      dataIndex: "Answer",
      key: "Answer",
      render: (text, record) =>
        editingKey === record.Label_id ? (
          <Input
            value={editingRow.Answer}
            onChange={(e) =>
              setEditingRow({ ...editingRow, Answer: e.target.value })
            }
          />
        ) : (
          text || "ยังไม่มีข้อมูล"
        ),
    },
    {
      title: "คะแนน",
      dataIndex: "Point_single",
      key: "Point_single",
      render: (text, record) =>
        record.isGroup ? (
          record.Point_Group !== null ? (
            <strong>{parseFloat(record.Point_Group).toFixed(2)}</strong>
          ) : (
            ""
          )
        ) : editingKey === record.Label_id ? (
          <Input
            value={editingRow.Point_single}
            onChange={(e) =>
              setEditingRow({ ...editingRow, Point_single: e.target.value })
            }
          />
        ) : text ? (
          parseFloat(text).toFixed(2)
        ) : (
          "ยังไม่มีข้อมูล"
        ),
    },
    {
      title: "ประเภท",
      dataIndex: "Group_No",
      key: "Group_No",
      render: (_, record) => {
        if (record.isGroup) {
          // รีเซ็ต displayedGroups เมื่อ render
          if (!displayedGroups.current.has(record.Group_No)) {
            displayedGroups.current.add(record.Group_No);
            return `Group ${record.Group_No}`; // แสดง Group สำหรับข้อแรก
          }
          return ""; // แสดงว่างสำหรับข้ออื่นในกลุ่มเดียวกัน
        }
        return "Single"; // แสดง Single สำหรับข้อที่ไม่ใช่กลุ่ม
      },
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) =>
        editingKey === record.Label_id ? (
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
        ),
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
                {subject.Subject_id} ({subject.Subject_name})
              </Option>
            ))}
          </Select>
        </div>
      </div>
      <Table
        dataSource={dataSource}
        columns={columns}
        rowKey="key"
        pagination={{
          pageSize: 8,
          onChange: () => displayedGroups.current.clear(),
        }}
        className="custom-table"
        rowClassName={(record) => (record.isGroup ? "group-row" : "")}
      />
    </div>
  );
};

export default EditLabel;
