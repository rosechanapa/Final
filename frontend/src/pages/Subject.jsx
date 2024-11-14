import React, { useState, useEffect } from "react";
import "../css/Subject.css";
import { Card, Table, Input, Menu, Dropdown, Button } from "antd";
import Button2 from "../components/Button";
import Empty from "../img/empty1.png";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import MoreVertIcon from "@mui/icons-material/MoreVert";
const Subject = () => {
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [subjectList, setSubjectList] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [editingKey, setEditingKey] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const handleAddSubjectClick = () => {
    setIsAddingSubject(true);
  };

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("http://localhost:5000/get_subjects"); // Change this to your actual endpoint
        const data = await response.json();
        setSubjectList(
          data.map((subject, index) => ({
            key: index,
            id: subject.Subject_id,
            name: subject.Subject_name,
          }))
        );
      } catch (error) {
        console.error("Failed to fetch subjects:", error);
      }
    };
    fetchSubjects();
  }, []);

  const handleSaveSubject = async (e) => {
    e.preventDefault();
    if (subjectId && subjectName) {
      try {
        const response = await fetch("http://localhost:5000/add_subject", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            Subject_id: subjectId,
            Subject_name: subjectName,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          alert(result.message);
          setSubjectList([
            ...subjectList,
            { key: subjectList.length, id: subjectId, name: subjectName },
          ]);
          setSubjectId("");
          setSubjectName("");
          setIsAddingSubject(false);
        }
      } catch (error) {
        console.error("Error:", error);
        alert("Failed to add subject.");
      }
    }
  };

  const handleDeleteSelected = async () => {
    try {
      // ส่งคำขอ DELETE ไปยัง backend สำหรับรายการที่เลือก
      await Promise.all(
        selectedRowKeys.map(async (key) => {
          const subjectToDelete = subjectList.find((item) => item.key === key);
          if (subjectToDelete) {
            await fetch(
              `http://localhost:5000/delete_subject/${subjectToDelete.id}`,
              {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
          }
        })
      );

      setSubjectList(
        subjectList.filter((item) => !selectedRowKeys.includes(item.key))
      );
      setSelectedRowKeys([]);
    } catch (error) {
      console.error("Error deleting subjects:", error);
      alert("Failed to delete selected subjects.");
    }
  };
  const handleEdit = (record) => {
    setEditingKey(record.key);
    setSubjectId(record.id);
    setSubjectName(record.name);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch("http://localhost:5000/edit_subject", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Subject_id: subjectId,
          Subject_name: subjectName,
        }),
      });

      const result = await response.json();
      alert(result.message);

      if (response.ok) {
        setSubjectList((prevList) =>
          prevList.map((item) =>
            item.key === editingKey
              ? { ...item, id: subjectId, name: subjectName }
              : item
          )
        );
        setEditingKey(null);
        setSubjectId("");
        setSubjectName("");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to update subject.");
    }
  };

  const columns = [
    {
      title: "รหัสวิชา",
      dataIndex: "id",
      key: "id",
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
      title: "ชื่อวิชา",
      dataIndex: "name",
      key: "name",
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
      render: (_, record) =>
        editingKey === record.key ? (
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
        ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
    columnWidth: 60,
  };

  const menu = (
    <Menu>
      <Menu.Item key="1" onClick={handleDeleteSelected}>
        Delete All Selected
      </Menu.Item>
    </Menu>
  );

  return (
    <div>
      <h1 className="Title">รายวิชาทั้งหมด</h1>
      {!isAddingSubject ? (
        <Card
          title={
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <label className="label">รายวิชาทั้งหมดที่มี</label>
              <div style={{ display: "flex", alignItems: "center" }}>
                {subjectList.length > 0 && (
                  <Button2
                    variant="primary"
                    size="sm"
                    onClick={handleAddSubjectClick}
                  >
                    <AddCircleIcon
                      style={{ fontSize: "22px", marginRight: "10px" }}
                    />
                    เพิ่มวิชา
                  </Button2>
                )}
                <Dropdown
                  overlay={menu}
                  trigger={["click"]}
                  placement="bottomRight"
                >
                  <Button
                    icon={<MoreVertIcon />}
                    style={{ marginLeft: "10px", height: 45, width: 40 }}
                  />
                </Dropdown>
              </div>
            </div>
          }
          className="card-edit"
          style={{
            width: "100%",
            height: 600,
            margin: "0 auto",
          }}
        >
          <div className="content-card">
            {subjectList.length > 0 ? (
              <>
                <Table
                  rowSelection={rowSelection}
                  dataSource={subjectList}
                  columns={columns}
                  pagination={{ pageSize: 4 }}
                  style={{ width: "100%" }}
                  className="custom-table"
                />
                {selectedRowKeys.length > 0 && (
                  <div style={{ marginTop: "16px" }}>
                    <Button2
                      variant="danger"
                      size="sm"
                      onClick={handleDeleteSelected}
                      style={{ marginBottom: "25px" }}
                    >
                      ลบที่เลือก
                    </Button2>
                  </div>
                )}
              </>
            ) : (
              <>
                <img src={Empty} className="Empty-img" alt="Logo" />
                <label className="label2">ยังไม่มีรายวิชาที่เพิ่ม</label>
                <Button2
                  variant="primary"
                  size="md"
                  onClick={handleAddSubjectClick}
                >
                  เพิ่มวิชาที่นี่
                </Button2>
              </>
            )}
          </div>
        </Card>
      ) : (
        <Card
          title="เพิ่มวิชาใหม่"
          className="card-edit"
          style={{
            width: "100%",
            height: 600,
            margin: "0 auto",
          }}
        >
          <div className="input-container">
            <form onSubmit={handleSaveSubject}>
              <div className="input-group">
                <label className="label">รหัสวิชา:</label>
                <input
                  className="input-box"
                  type="text"
                  placeholder="ระบุรหัสวิชา..."
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">ชื่อวิชา:</label>
                <input
                  className="input-box"
                  type="text"
                  placeholder="ระบุชื่อวิชา..."
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                />
              </div>
              <div className="Button-container">
                <Button2 variant="primary" size="md" type="submit">
                  บันทึก
                </Button2>
              </div>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Subject;
