import React, { useState, useEffect } from "react";
import "../css/Subject.css";
import { Card, Table, Tooltip, Modal, message } from "antd";
import Button from "../components/Button";
import Empty from "../img/empty1.png";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import { ExclamationCircleFilled } from "@ant-design/icons";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";


const Subject = () => {
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [subjectList, setSubjectList] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [editingKey, setEditingKey] = useState(null);
  // const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [deletingSubject, setDeletingSubject] = useState(null);
  // const [deletingMultiple, setDeletingMultiple] = useState(false); // สำหรับการลบหลายรายการ
  const [hasThaiError, setHasThaiError] = useState(false);
  const [loading, setLoading] = useState(false);

  const [editData, setEditData] = useState({
    old_subject_id: "",
    new_subject_id: "",
    subject_name: "",
  });

  const handleAddSubjectClick = () => {
    setIsAddingSubject(true);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;

    const hasThaiCharacters = /[ก-ฮะ-์]/.test(value);
    const hasSpecialCharacters = /[^a-zA-Z0-9\s]/.test(value);
    // อัปเดตสถานะแจ้งเตือน
    setHasThaiError(hasThaiCharacters || hasSpecialCharacters);
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

  const handleDeleteSubject = async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/delete_subject/${deletingSubject.id}`,
        {
          method: "DELETE",
        }
      );
      const result = await response.json();
      if (response.ok) {
        setSubjectList(
          subjectList.filter((subject) => subject.id !== deletingSubject.id)
        );
        setDeletingSubject(null); // ปิด Modal
        alert(result.message); // แจ้งเตือนสำเร็จ
      } else {
        console.error("Error deleting subject:", result.message);
      }
    } catch (error) {
      console.error("Failed to delete subject:", error);
    }
  };

  const handleEdit = (record) => {
    setEditingKey(record.key); // เปิดใช้งานโหมดแก้ไข
    setEditData({
      oldSubjectId: record.id, // รหัสวิชาเดิม
      subjectId: record.id, // ตั้งค่าเริ่มต้น
      subjectName: record.name, // ชื่อวิชาเริ่มต้น
    });
  };
  const handleCancelEdit = () => {
    setEditingKey(null); // ปิดโหมดแก้ไข
    setEditData({
      oldSubjectId: "", // ล้างค่า
      subjectId: "",
      subjectName: "",
    });
  };

  const handleCheckDuplicateAndSave = () => {
    const { oldSubjectId, subjectId, subjectName } = editData;

    if (!oldSubjectId || !subjectId || !subjectName) {
      message.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    // ถ้า new_subject_id = subjectId เหมือนเดิม (ไม่ได้เปลี่ยน) ก็ไม่ต้องเช็คซ้ำ
    if (oldSubjectId !== subjectId) {
      // (2) ตรวจสอบใน subjectList ว่ามีใครใช้ subjectId (ใหม่) แล้วหรือไม่
      const isDuplicate = subjectList.some(
        (item) => item.id === subjectId && item.id !== oldSubjectId
      );

      if (isDuplicate) {
        message.error("รหัสวิชานี้ถูกใช้แล้ว ไม่สามารถซ้ำได้");
        return;
      }
    }
    handleSaveEdit();
  };

  const handleSaveEdit = async () => {
    const { oldSubjectId, subjectId, subjectName } = editData;

    try {
      const response = await fetch("http://127.0.0.1:5000/edit_subject", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          old_subject_id: oldSubjectId, // ใช้เพื่อ WHERE
          new_subject_id: subjectId, // ค่าใหม่ที่จะแทน
          subject_name: subjectName, // ชื่อวิชาใหม่
        }),
      });

      const result = await response.json();
      if (response.ok) {
        // อัปเดต list ในฝั่ง Front-end
        const updatedSubjects = subjectList.map((item) => {
          return item.id === oldSubjectId
            ? { ...item, id: subjectId, key: subjectId, name: subjectName } // return ค่าอ็อบเจ็กต์ใหม่
            : item; // return ค่าเดิมถ้าไม่ใช่แถวที่ต้องการอัปเดต
        });

        setSubjectList(updatedSubjects);
        setEditingKey(null); // ออกจากโหมดแก้ไข
        message.success(result.message); // แสดงผลลัพธ์
      } else {
        console.error("Error updating subject:", result.message);
        message.error(result.message);
      }
    } catch (error) {
      console.error("Failed to update subject:", error);
      message.error("Error updating subject");
    }
  };

  const columns = [
    {
      title: <span style={{ paddingLeft: "20px" }}>รหัสวิชา</span>,

      dataIndex: "id",
      key: "id",
      width: 250,
      render: (text, record) =>
        editingKey === record.key ? (
          <input
            style={{ width: "250px", height: "35px" }}
            className="input-box-subject"
            value={editData.subjectId}
            onChange={(e) =>
              setEditData({
                ...editData,
                subjectId: e.target.value,
              })
            }
          />
        ) : (
          <div style={{ paddingLeft: "20px" }}>{text}</div> // เพิ่ม padding ซ้าย
        ),
    },
    {
      title: "ชื่อวิชา",
      dataIndex: "name",
      key: "name",
      width: 400,
      render: (text, record) =>
        editingKey === record.key ? (
          <input
            style={{ width: "420px", height: "35px" }}
            className="input-box-subject"
            value={editData.subjectName}
            onChange={(e) =>
              setEditData({
                ...editData,
                subjectName: e.target.value,
              })
            }
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
            <>
              {/* ปุ่ม Save */}
              <Tooltip title="บันทึกข้อมูล" className="tooltip-edit">
                <div>
                  <Button size="edit" onClick={handleCheckDuplicateAndSave}>
                    <SaveIcon />
                  </Button>
                </div>
              </Tooltip>
              

              {/* ปุ่ม Cancel */}
              <Tooltip title="ยกเลิกการแก้ไข">
                <div>
                  <Button
                    variant="danger"
                    size="edit"
                    onClick={handleCancelEdit} // ยกเลิกการแก้ไข
                  >
                    <CloseIcon />
                  </Button>
                </div>
              </Tooltip>
              
            </>
          ) : (
            <>
              <Tooltip title="แก้ไขข้อมูล">
                <div>
                  <Button size="edit" onClick={() => handleEdit(record)}>
                    <EditIcon />
                  </Button>
                </div>
              </Tooltip>

              <Tooltip title="ลบข้อมูล">
                <div>
                  <Button
                    variant="danger"
                    size="edit"
                    onClick={() => setDeletingSubject(record)} // แสดง Modal // ลบแถวที่เลือก
                  >
                    <DeleteIcon />
                  </Button>
                </div>
              </Tooltip>
            </>
          )}
        </div>
      ),
    },
  ];

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
                      style={{ fontSize: "18px", marginRight: "10px" }}
                    />
                    เพิ่มวิชา
                  </Button>
                )}
              </div>
            </div>
          }
          className="card-edit"
          style={{
            width: "100%",
            height: "600px",
            margin: "0 auto",
          }}
        >
          <div className="content-card">
            {subjectList.length > 0 ? (
              <>
                <Table
                  dataSource={subjectList}
                  columns={columns}
                  pagination={{ pageSize: 5 }}
                  style={{ width: "100%" }}
                  className="custom-table"
                />
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
          title={
            <div style={{ display: "flex", alignItems: "center" }}>
              <ArrowBackIcon
                className="icon-styled"
                onClick={() => setIsAddingSubject(false)}
              ></ArrowBackIcon>
              <label className="label">เพิ่มวิชาใหม่</label>
            </div>
          }
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
                  style={{ width: "320px", height: "35px" }}
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
                  style={{ width: "320px", height: "35px" }}
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
                  ยืนยัน
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}
      <Modal
        open={!!deletingSubject} // แสดง Modal เมื่อมีค่าของ deletingSubject
        title="Confirm Deletion"
        onCancel={() => setDeletingSubject(null)} // ปิด Modal
        onOk={handleDeleteSubject} // ลบรายการเมื่อกด Confirm
        icon={<ExclamationCircleFilled />}
        okText="Confirm"
        cancelText="Cancel"
        width={450}
        className="custom-modal"
      >
        คุณแน่ใจหรือไม่ว่าต้องการลบวิชา:{" "}
        <strong>{deletingSubject?.name}</strong>?
      </Modal>
    </div>
  );
};

export default Subject;