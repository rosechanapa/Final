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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";


const Subject = () => {
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [subjectList, setSubjectList] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [editingKey, setEditingKey] = useState(null);
  const [deletingSubject, setDeletingSubject] = useState(null);
  const [hasThaiError, setHasThaiError] = useState(false);

  // เก็บข้อมูลสำหรับแก้ไข โดยต้องมี old_subject_id, new_subject_id, subject_name
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
      const response = await fetch(`http://127.0.0.1:5000/delete_subject/${deletingSubject.id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (response.ok) {
        setSubjectList(subjectList.filter(subject => subject.id !== deletingSubject.id));
        setDeletingSubject(null); // ปิด Modal
        alert(result.message); // แจ้งเตือนสำเร็จ
      } else {
        console.error("Error deleting subject:", result.message);
      }
    } catch (error) {
      console.error("Failed to delete subject:", error);
    }
  };
  

  // ฟังก์ชันกดปุ่ม Edit
  const handleEdit = (record) => {
    setEditingKey(record.key);
    // เก็บค่าลง editData
    setEditData({
      oldSubjectId: record.id,   // รหัสวิชาเดิม
      subjectId: record.id,      // ตั้งไว้เหมือน oldSubjectId ก่อน 
      subjectName: record.name,
    });
  };
  

  // ฟังก์ชันกดปุ่ม Save
  const handleSaveEdit = async () => {
    const { oldSubjectId, subjectId, subjectName } = editData;

    // ตรวจสอบค่าว่าง
    if (!oldSubjectId || !subjectId || !subjectName) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    try {
      // ส่งค่าไปแก้ไขที่ Back-end
      const response = await fetch("http://127.0.0.1:5000/edit_subject", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          old_subject_id: oldSubjectId, // ใช้เพื่อ WHERE
          new_subject_id: subjectId,    // ค่าใหม่ที่จะแทน
          subject_name: subjectName,    // ชื่อวิชาใหม่
        }),
      });

      const result = await response.json();
      if (response.ok) {
        // อัปเดต list ในฝั่ง Front-end
        const updatedSubjects = subjectList.map((item) => {
          // หาแถวเดิมที่มี id ตรงกับ oldSubjectId
          if (item.id === oldSubjectId) {
            // เปลี่ยนค่าตามที่แก้ไข
            return {
              ...item,
              id: subjectId,
              key: subjectId, // key ก็ต้องเปลี่ยนให้ตรง id
              name: subjectName,
            };
          }
          return item;
        });

        setSubjectList(updatedSubjects);
        setEditingKey(null); // ออกจากโหมดแก้ไข
        alert(result.message); // แสดงผลลัพธ์
      } else {
        console.error("Error updating subject:", result.message);
      }
    } catch (error) {
      console.error("Failed to update subject:", error);
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
            value={editData.subjectId}
            onChange={(e) =>
              setEditData({
                ...editData,
                subjectId: e.target.value,
              })
            }
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
              <Button size="edit" onClick={handleSaveEdit}>
                <SaveIcon />
              </Button>

              {/* ปุ่ม Cancel */}
              <Button
                variant="danger"
                size="edit"
                onClick={() => setEditingKey(null)} // ยกเลิกการแก้ไข
              >
                <CloseIcon />
              </Button>
            </>
          ) : (
            <>
              <Button size="edit" onClick={() => handleEdit(record)}>
                <EditIcon />
              </Button>

              <Button
                variant="danger"
                size="edit"
                onClick={() => setDeletingSubject(record)} // แสดง Modal // ลบแถวที่เลือก
              >
                <DeleteIcon />
              </Button>
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
                      style={{ fontSize: "22px", marginRight: "10px" }}
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
            height: 600,
            margin: "0 auto",
          }}
        >
          <div className="content-card">
            {subjectList.length > 0 ? (
              <>
                {/* ตารางสำหรับแสดงรายวิชา */}
                <Table
                  dataSource={subjectList}
                  columns={columns}
                  pagination={{ pageSize: 4 }}
                  style={{ width: "100%" }}
                  className="custom-table"
                />
              </>
            ) : (
              // กรณีไม่มีข้อมูลใน subjectList
              <>
                <img src={Empty} className="Empty-img" alt="Logo" />
                <label className="label2">ยังไม่มีรายวิชาที่เพิ่ม</label>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleAddSubjectClick} // เปิดฟอร์มเพิ่มวิชา
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
              <span>เพิ่มวิชาใหม่</span>
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
                  ยืนยัน
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}
      <Modal
        open={!!deletingSubject}
        title="Confirm Deletion"
        onCancel={() => setDeletingSubject(null)} // ปิด Modal
        onOk={handleDeleteSubject} // ลบรายการเมื่อกด Confirm
        icon={<ExclamationCircleFilled />}
        okText="Confirm"
        cancelText="Cancel"
        width={550}
        className="custom-modal"
      >
        คุณแน่ใจหรือไม่ว่าต้องการลบวิชา:{" "}
        <strong>{deletingSubject?.name}</strong>?
      </Modal>
    </div>
  );
};

export default Subject;