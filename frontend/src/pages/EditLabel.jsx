import React, { useState, useEffect } from "react";
import "../css/editlabel.css";
import { Table, Input, Select, message, Button } from "antd";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import axios from "axios";

const { Option } = Select;

const EditLabel = () => {
  const [dataSource, setDataSource] = useState([]);
  const [editingKey, setEditingKey] = useState(null);
  const [editingRow, setEditingRow] = useState({});
  const [subjectList, setSubjectList] = useState([]); // List of subjects
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectId, setSubjectId] = useState("");

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
      if (response.data.status === "success") {
        const data = response.data.data.map((item, index) => ({
          ...item,
          index: index + 1, // Add a running index
        }));
        setDataSource(data);
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error fetching labels:", error);
      message.error("Failed to fetch labels");
    }
  };

  // const handleEdit = (record) => {
  //   setEditingKey(record.key);
  //   setEditingRow({ ...record });
  // };

  // const handleSaveEdit = async () => {
  //   try {
  //     const response = await axios.put(
  //       `http://127.0.0.1:5000/update_label/${editingRow.Label_id}`,
  //       {
  //         Answer: editingRow.Answer,
  //         Point_single: editingRow.Point_single,
  //       }
  //     );
  //     if (response.data.status === "success") {
  //       message.success("Label updated successfully");
  //       setEditingKey(null);
  //       fetchLabels(selectedSubject); // Refresh the data
  //     } else {
  //       message.error(response.data.message);
  //     }
  //   } catch (error) {
  //     console.error("Error updating label:", error);
  //     message.error("Failed to update label");
  //   }
  // };

  const columns = [
    {
      title: "ลำดับที่",
      dataIndex: "index",
      key: "index",
      width: 100,
    },
    {
      title: "ข้อที่",
      dataIndex: "No",
      key: "No",
      width: 100,
    },
    {
      title: "เฉลย",
      dataIndex: "Answer",
      key: "Answer",
      render: (text, record) =>
        editingKey === record.key ? (
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
        editingKey === record.key ? (
          <Input
            value={editingRow.Point_single}
            onChange={(e) =>
              setEditingRow({ ...editingRow, Point_single: e.target.value })
            }
          />
        ) : (
          text || "ยังไม่มีข้อมูล"
        ),
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) =>
        editingKey === record.key ? (
          <Button type="primary">
            {/* // onClick={handleSaveEdit}> */}
            <SaveIcon />
          </Button>
        ) : (
          <Button
            type="default"

            // onClick={() => handleEdit(record)}
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
        pagination={false}
        className="custom-table"
      />
    </div>
  );
};

export default EditLabel;
