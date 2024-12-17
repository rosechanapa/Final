import React, { useState, useEffect } from "react";
import "../css/Subject.css";
import { Card, Table, Input, Modal } from "antd";
// import { Menu, Dropdown, Button } from "antd";
import Button from "../components/Button";
import Empty from "../img/empty1.png";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
// import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteIcon from "@mui/icons-material/Delete";
import { ExclamationCircleFilled } from "@ant-design/icons";
const Subject = () => {
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [subjectList, setSubjectList] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [editingKey, setEditingKey] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [deletingSubject, setDeletingSubject] = useState(null);
  const [deletingMultiple, setDeletingMultiple] = useState(false); // สำหรับการลบหลายรายการ
  const [hasThaiError, setHasThaiError] = useState(false);
  const handleAddSubjectClick = () => {
    setIsAddingSubject(true);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    // อนุญาตเฉพาะตัวอักษรภาษาอังกฤษและตัวเลข
    // const validValue = value.replace(/[^a-zA-Z0-9]/g, "");
    const hasThaiCharacters = /[ก-ฮะ-์]/.test(value);
    setHasThaiError(hasThaiCharacters); // อัปเดตสถานะแจ้งเตือน
    setSubjectId(value); // อนุญาตให้พิมพ์ได้ทุกภาษา
  };

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/get_subjects"); // Change this to your actual endpoint
        const data = await response.json();
        setSubjectList(
          data.map((subject, index) => ({
            key: subject.Subject_id, // ใช้ id เป็น key
            id: subject.Subject_id, // id จาก backend
            name: subject.Subject_name, // ชื่อวิชา
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
        const response = await fetch("http://127.0.0.1:5000/add_subject", {
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

  const handleDeleteSubject = async (id = null) => {
    try {
      // เลือก keysToDelete จาก id หรือ selectedRowKeys
      const keysToDelete = id ? [id] : selectedRowKeys;

      // วนลูปลบวิชาตาม keysToDelete
      await Promise.all(
        keysToDelete.map(async (deleteKey) => {
          const subjectToDelete = subjectList.find(
            (item) => item.key === deleteKey
          );
          if (subjectToDelete) {
            await fetch(
              `http://127.0.0.1:5000/delete_subject/${subjectToDelete.id}`,
              {
                method: "DELETE",
              }
            );
          }
        })
      );

      // อัปเดต subjectList ลบรายการที่ถูกเลือก
      setSubjectList(
        subjectList.filter((item) => !keysToDelete.includes(item.key))
      );

      // เคลียร์ selectedRowKeys เมื่อเป็นการลบหลายรายการ
      if (!id) {
        setSelectedRowKeys([]);
      }

      alert("Subject(s) deleted successfully.");
    } catch (error) {
      console.error("Error deleting subject(s):", error);
      alert("Failed to delete subject(s).");
    }
  };

  const handleEdit = (record) => {
    setEditingKey(record.key);
    setSubjectId(record.id);
    setSubjectName(record.name);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/edit_subject", {
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
      // title: <span style={{ paddingLeft: "20px" }}>รหัสวิชา</span>,
      title: "รหัสวิชา",
      dataIndex: "id",
      key: "id",
      width: 50,
      render: (text, record) =>
        editingKey === record.key ? (
          <Input
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          />
        ) : (
          text // <div style={{ paddingLeft: "20px" }}>{text}</div> // เพิ่ม padding ซ้าย
        ),
    },
    {
      title: "ชื่อวิชา",
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
            <Button
              variant="outlined"
              size="edit"
              onClick={() => handleSaveEdit(record)}
            >
              <SaveIcon />
            </Button>
          ) : (
            <Button
              variant="outlined"
              size="edit"
              onClick={() => handleEdit(record)}
            >
              <EditIcon />
            </Button>
          )}
          <Button
            variant="danger"
            size="edit"
            onClick={() => setDeletingSubject(record)}
          >
            <DeleteIcon />
          </Button>
        </div>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
    columnWidth: 50,
  };

  // const menu = (
  //   <Menu>
  //     <Menu.Item key="1" onClick={handleDeleteSubject}>
  //       Delete All Selected
  //     </Menu.Item>
  //   </Menu>
  // );

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
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAddSubjectClick}
                  >
                    <AddCircleIcon
                      style={{ fontSize: "22px", marginRight: "10px" }}
                    />
                    เพิ่มวิชา
                  </Button>
                )}

                {/* <Dropdown
                  overlay={menu}
                  trigger={["click"]}
                  placement="bottomRight"
                >
                  <Button
                    icon={<MoreVertIcon />}
                    style={{ marginLeft: "10px", height: 45, width: 40 }}
                  />
                </Dropdown> */}
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
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeletingMultiple(true)}
                      style={{ marginBottom: "50px" }}
                    >
                      ลบวิชาที่ถูกเลือก
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <img src={Empty} className="Empty-img" alt="Logo" />
                <label className="label2">ยังไม่มีรายวิชาที่เพิ่ม</label>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleAddSubjectClick}
                >
                  เพิ่มวิชาที่นี่
                </Button>
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
                {hasThaiError && (
                  <p className="label-error">
                    *ใส่เลขหรือตัวอักษรภาษาอังกฤษเท่านั้น
                  </p>
                )}
                <input
                  className={`input-box ${hasThaiError ? "error" : ""}`}
                  type="text"
                  placeholder="ระบุรหัสวิชา..."
                  value={subjectId}
                  onChange={handleInputChange}
                  required
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
                  required
                />
              </div>
              <div className="Button-container">
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={hasThaiError}
                >
                  บันทึก
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}
      <Modal
        visible={!!deletingSubject}
        title="Confirm Deletion"
        onCancel={() => setDeletingSubject(null)} // ปิด Modal
        onOk={() => {
          handleDeleteSubject(deletingSubject?.id); // ลบรายการที่เลือก
          setDeletingSubject(null); // ปิด Modal หลังลบ
        }}
        icon={<ExclamationCircleFilled />}
        okText="Confirm"
        cancelText="Cancel"
        width={550}
        className="custom-modal"
      >
        คุณแน่ใจหรือไม่ว่าต้องการลบวิชา:{" "}
        <strong>{deletingSubject?.name}</strong>?
      </Modal>
      <Modal
        visible={deletingMultiple}
        title="Confirm Deletion"
        onCancel={() => setDeletingMultiple(false)} // ปิด Modal
        onOk={() => {
          handleDeleteSubject(); // ลบหลายรายการ
          setDeletingMultiple(false); // ปิด Modal หลังลบ
        }}
        icon={<ExclamationCircleFilled />}
        okText="Confirm"
        cancelText="Cancel"
        width={550}
        className="custom-modal"
      >
        คุณแน่ใจหรือไม่ว่าต้องการลบวิชาทั้งหมดที่เลือกไว้?
      </Modal>
    </div>
  );
};

export default Subject;
