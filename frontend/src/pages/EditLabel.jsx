import { React, useState } from "react";
import "../css/editlabel.css";
import { Card, Table, Input, Modal } from "antd";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import Button2 from "../components/Button";
import Empty from "../img/empty1.png";
const EditLabel = () => {
  const [dataSource, setDataSource] = useState([]); // แหล่งข้อมูลของเฉลยข้อสอบ
  const [editingKey, setEditingKey] = useState(""); // คีย์ของข้อที่กำลังแก้ไข
  const [subjectId, setSubjectId] = useState(""); // สำหรับจัดการข้อมูล Input
  const [subjectName, setSubjectName] = useState(""); // สำหรับจัดการข้อมูล Input

  const handleEdit = (record) => {
    setEditingKey(record.key);
    setSubjectId(record.no); // ตั้งค่าเริ่มต้นสำหรับการแก้ไข
    setSubjectName(record.name); // ตั้งค่าเริ่มต้นสำหรับการแก้ไข
  };

  const handleSaveEdit = (record) => {
    const newData = [...dataSource];
    const index = newData.findIndex((item) => record.key === item.key);
    if (index > -1) {
      const item = newData[index];
      newData.splice(index, 1, { ...item, no: subjectId, name: subjectName });
      setDataSource(newData);
      setEditingKey(""); // ออกจากโหมดแก้ไข
    } else {
      // กรณีไม่พบข้อมูล
      setEditingKey("");
    }
  };

  const columns = [
    {
      title: "ลำดับข้อ",
      dataIndex: "no",
      key: "no",
      width: 50,
      render: (text, record) =>
        editingKey === record.key ? (
          <Input
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          />
        ) : (
          text
        ),
    },
    {
      title: "เฉลย",
      dataIndex: "name",
      key: "name",
      width: 300,
      render: (text, record) =>
        editingKey === record.key ? (
          <Input
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
          />
        ) : (
          text
        ),
    },
    {
      title: "คะแนน",
      dataIndex: "name",
      key: "name",
      width: 300,
      render: (text, record) =>
        editingKey === record.key ? (
          <Input
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
          />
        ) : (
          text
        ),
    },
    {
      title: "รูปแบบคะแนน",
      dataIndex: "name",
      key: "name",
      width: 300,
      render: (text, record) =>
        editingKey === record.key ? (
          <Input
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
          />
        ) : (
          text
        ),
    },
    {
      title: "Action",
      key: "action",
      width: 150,
      render: (_, record) => (
        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          {editingKey === record.key ? (
            <Button2
              variant="outlined"
              size="edit"
              onClick={() => handleSaveEdit(record)}
            >
              <SaveIcon />
            </Button2>
          ) : (
            <Button2
              variant="outlined"
              size="edit"
              onClick={() => handleEdit(record)}
            >
              <EditIcon />
            </Button2>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <h1 className="Title">เฉลยของข้อสอบทั้งหมด</h1>
      <Card
        title="เฉลยของข้อสอบทั้งหมด"
        className="card-edit"
        style={{
          width: "100%",
          height: 600,
          margin: "0 auto",
        }}
      >
        {dataSource.length === 0 ? (
          <div className="empty-container">
            <img src={Empty} className="Empty-img" alt="Logo" />
            <label className="label2">ไม่พบเฉลย</label>
          </div>
        ) : (
          <Table
            dataSource={dataSource}
            columns={columns}
            rowKey="key"
            pagination={false}
          />
        )}
      </Card>
    </div>
  );
};

export default EditLabel;
