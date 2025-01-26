import React, { useState, useEffect } from "react";
import {
  Select,
  Input,
  Button,
  Modal,
  Form,
  Upload,
  message,
  Table,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import Button2 from "../components/Button";
import "../css/studentfile.css";
import EditIcon from "@mui/icons-material/Edit";
// import SaveIcon from "@mui/icons-material/Save";
// import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import { saveAs } from "file-saver";
import Papa from "papaparse";

const { Option } = Select;
const { Search } = Input;

const StudentFile = () => {
  const [students, setStudents] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [section, setSection] = useState("");
  const [subjectList, setSubjectList] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [uploadedFileList, setUploadedFileList] = useState([]);
  const [sections, setSections] = useState([]);
  const [originalStudents, setOriginalStudents] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const [modalSubjectId, setModalSubjectId] = useState("");
  const [editingKey, setEditingKey] = useState("");
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [editData, setEditData] = useState({});
  const [deletingStudent, setDeletingStudent] = useState(null);

  const handleSubjectChange = (value) => {
    setSubjectId(value);
    setSection("");
    setStudents([]);
    fetchSections(value);
    fetchStudents(value, "");
  };

  const handleSectionChange = (value) => {
    setSection(value);
    setStudents([]);
    fetchStudents(subjectId, value);
    setOriginalStudents([]);
  };

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/get_subjects");
        const data = await response.json();
        setSubjectList(data);

        // ตั้งค่า subjectId เป็น Subject_id แรกที่เจอ
        if (data.length > 0) {
          const firstSubjectId = data[0].Subject_id;
          setSubjectId(firstSubjectId);
          fetchSections(firstSubjectId);
          fetchStudents(firstSubjectId, "");
        }
      } catch (error) {
        console.error("Error fetching subjects:", error);
      }
    };

    fetchSubjects();
  }, []);

  const fetchStudents = async (subjectId, section) => {
    // สร้าง URL พร้อม Query Parameters
    const url = new URL("http://127.0.0.1:5000/get_students");
    url.searchParams.append("subjectId", subjectId);
    if (section) url.searchParams.append("section", section);

    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setStudents(data); // แสดงข้อมูลนักศึกษาเฉพาะ Section ปัจจุบัน
        setOriginalStudents(data);
      } else {
        const errorData = await response.json();
        message.error(errorData.error || "Failed to fetch students.");
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      message.error("Failed to fetch students.");
    }
  };

  const fetchSections = async (subjectId) => {
    if (!subjectId) {
      setSections([]); // รีเซ็ต sections
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/get_sections?subjectId=${subjectId}`
      );
      if (response.ok) {
        const data = await response.json();
        setSections(data);
      } else {
        // const errorData = await response.json();
        message.error("Failed to fetch sections.");
        // setSections([]); // รีเซ็ต sections
      }
    } catch (error) {
      console.error("Error fetching sections:", error);
      message.error("Failed to fetch sections.");
      // setSections([]); // รีเซ็ต sections
    }
  };
  useEffect(() => {
    if (subjectId && section) {
      fetchStudents(subjectId, section);
    }
  }, [subjectId, section]);
  const highlightText = (text, searchValue) => {
    // ตรวจสอบและแปลง text เป็น string หากไม่ใช่ string
    if (typeof text !== "string") text = String(text);

    if (!searchValue) return text; // ถ้าไม่มีคำค้นหา แสดงข้อความปกติ
    const regex = new RegExp(`(${searchValue})`, "gi"); // สร้าง regex สำหรับคำค้นหา
    const parts = text.split(regex); // แยกข้อความตามคำค้นหา

    return parts.map((part, index) =>
      part.toLowerCase() === searchValue.toLowerCase() ? (
        <span key={index} style={{ backgroundColor: "#d7ebf8" }}>
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const handleEdit = (record) => {
    setEditingKey(record.Student_id);
    setEditData({
      studentId: record.Student_id,
      studentName: record.Full_name,
      section: record.Section,
    });
  };

  const handleSave = async () => {
    const updatedData = {
      oldStudentId: editingKey,
      newStudentId: editData.studentId,
      Full_name: editData.studentName,
      Section: editData.section,
    };

    try {
      const response = await fetch("http://127.0.0.1:5000/edit_student", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        throw new Error("Failed to update student.");
      }

      message.success("Student updated successfully.");
      setEditingKey("");

      // Reload students for the new section
      setSection(editData.section);
      await fetchStudents(subjectId, editData.section); // Reload with new Section
    } catch (error) {
      console.error("Error updating student:", error);
      message.error("Failed to update student.");
    }
  };

  const handleCancelEdit = () => {
    setEditingKey("");
    setEditData({});
  };
  const handleDelete = async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/delete_student/${deletingStudent.Student_id}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        message.success("Student deleted successfully.");
        setStudents((prev) =>
          prev.filter(
            (student) => student.Student_id !== deletingStudent.Student_id
          )
        );
        setIsDeleteModalVisible(false);
        setDeletingStudent(null);
      } else {
        message.error("Failed to delete student.");
      }
    } catch (error) {
      console.error("Error deleting student:", error);
      message.error("Error deleting student.");
    }
  };

  const columns = [
    {
      title: <span style={{ paddingLeft: "20px" }}>Student ID</span>,
      dataIndex: "Student_id",
      key: "Student_id",
      width: 220,
      render: (text, record) =>
        editingKey === record.Student_id ? (
          <input
            style={{ width: "300px", height: "40px" }}
            className="input-box-subject"
            value={editData.studentId}
            onChange={(e) =>
              setEditData((prev) => ({ ...prev, studentId: e.target.value }))
            }
          />
        ) : (
          <div style={{ paddingLeft: "20px" }}>
            {highlightText(text, searchValue)}
          </div>
        ),
    },
    {
      title: "Full Name",
      dataIndex: "Full_name",
      key: "Full_name",
      width: 400,
      render: (text, record) =>
        editingKey === record.Student_id ? (
          <input
            style={{ width: "300px", height: "40px" }}
            className="input-box-subject"
            value={editData.studentName}
            onChange={(e) =>
              setEditData((prev) => ({ ...prev, studentName: e.target.value }))
            }
          />
        ) : (
          highlightText(text, searchValue)
        ),
    },
    {
      title: "Section",
      dataIndex: "Section",
      key: "Section",
      width: 150,
      render: (text, record) =>
        editingKey === record.Student_id ? (
          <input
            style={{ width: "250px", height: "40px" }}
            className="input-box-subject"
            value={editData.section}
            onChange={(e) =>
              setEditData((prev) => ({
                ...prev,
                section: e.target.value,
              }))
            }
          />
        ) : (
          highlightText(text, searchValue)
        ),
    },
    {
      title: "Total Score",
      dataIndex: "Total",
      key: "Total",
      align: "center",
      render: (total) => (total !== null ? total : "N/A"),
      width: 160,
    },
    {
      title: "Action",
      key: "action",
      width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: "10px" }}>
          {editingKey === record.Student_id ? (
            <>
              <Button2 variant="light" size="edit" onClick={handleSave}>
                <SaveIcon />
              </Button2>
              <Button2 variant="danger" size="edit" onClick={handleCancelEdit}>
                <CloseIcon />
              </Button2>
            </>
          ) : (
            <>
              <Button2
                variant="light"
                size="edit"
                onClick={() => handleEdit(record)}
              >
                <EditIcon />
              </Button2>
              <Button2
                variant="danger"
                size="edit"
                onClick={() => {
                  setDeletingStudent(record);
                  setIsDeleteModalVisible(true);
                }}
              >
                <DeleteIcon />
              </Button2>
            </>
          )}
        </div>
      ),
    },
  ];

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleUpload = ({ fileList }) => {
    setUploadedFileList(fileList);
  };

  const handleAddToTable = async () => {
    console.log("section:", section);

    if (!subjectId || !section.trim() || uploadedFileList.length === 0) {
      message.error("Please fill in all fields and upload a file.");
      return;
    }

    const formData = new FormData();
    formData.append("subjectId", modalSubjectId);
    formData.append("Section", section);
    formData.append("file", uploadedFileList[0].originFileObj);

    try {
      const response = await fetch("http://127.0.0.1:5000/csv_upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        message.success("Data submitted successfully.");

        fetchSections(modalSubjectId); // ดึงข้อมูล Section ใหม่
        fetchStudents(modalSubjectId, section);

        setModalSubjectId("");
        setSection(""); // รีเซ็ต section

        setIsModalVisible(false);
        setUploadedFileList([]);
      } else {
        const errorData = await response.json();
        message.error(`Failed to submit data: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Error submitting data:", error);
      message.error("Error submitting data.");
    }
  };

  const exportToCSV = () => {
    if (students.length === 0) {
      message.warning("ไม่มีข้อมูลนักศึกษาให้ Export");
      return;
    }

    const csvData = students.map((student) => ({
      "Student ID": `'${student.Student_id}`,
      "Full Name": student.Full_name,
      Section: student.Section || "N/A",
      Score: student.Score || "N/A",
    }));

    const csvString = Papa.unparse(csvData);

    const csvWithBOM = "\uFEFF" + csvString;

    const blob = new Blob([csvWithBOM], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "students.csv");
  };

  return (
    <div>
      <h1 className="Title">คะแนนนักศึกษา</h1>

      <div className="input-group-std">
        <div className="dropdown-group">
          <label className="label-std">วิชา: </label>
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
        <div className="dropdown-group">
          <label className="label-std">ตอนเรียน: </label>
          <Select
            className="custom-select"
            value={section || ""}
            onChange={handleSectionChange}
            placeholder="เลือกตอนเรียน..."
            style={{ width: 250, height: 40 }}
          >
            <Option value="">ทุกตอนเรียน</Option>
            {sections.map((sec) => (
              <Option key={sec} value={sec}>
                ตอนเรียน {sec}
              </Option>
            ))}
          </Select>
        </div>
      </div>
      <div className="Search-Export-container">
        <Search
          className="custom-search"
          placeholder="ค้นหา..."
          allowClear
          onChange={(e) => {
            const value = e.target.value.trim();
            setSearchValue(value);
            if (!value) {
              setStudents(originalStudents);
            } else {
              const filtered = originalStudents.filter(
                (student) =>
                  student.Student_id.includes(value) ||
                  student.Full_name.includes(value)
              );
              setStudents(filtered);
            }
          }}
          style={{
            width: "360px",
          }}
        />
        <div className="button-group">
          <Button2
            variant="primary"
            size="sm"
            className="button-add"
            onClick={showModal}
          >
            Add Student
          </Button2>

          <Button2
            variant="light"
            size="sm"
            className="button-export"
            onClick={exportToCSV}
          >
            Export CSV
          </Button2>
        </div>
      </div>

      <Table
        dataSource={students}
        columns={columns}
        rowKey="Student_id"
        pagination={{
          pageSize: 6,
          showSizeChanger: false,
        }}
        style={{ width: "100%", marginTop: 20 }}
        className="custom-table"
      />

      <Modal
        title="Confirm Deletion"
        visible={isDeleteModalVisible}
        onOk={handleDelete}
        onCancel={() => setIsDeleteModalVisible(false)}
        style={{ width: 550 }}
        className="custom-modal"
        okText="Delete"
        cancelText="Cancel"
      >
        {deletingStudent && (
          <p>
            Are you sure you want to delete the student{" "}
            <strong>{deletingStudent.Full_name}</strong> with ID{" "}
            <strong>{deletingStudent.Student_id}</strong> from Section{" "}
            <strong>{deletingStudent.Section}</strong>?
          </p>
        )}
      </Modal>

      <Modal
        title="Add Student"
        open={isModalVisible}
        footer={null}
        onCancel={() => setIsModalVisible(false)}
      >
        <Form className="form-container" layout="vertical">
          <Form.Item label="เลือกวิชา">
            <Select
              className="custom-select"
              value={modalSubjectId || undefined}
              onChange={(value) => setModalSubjectId(value)}
              placeholder="กรุณาเลือกรหัสวิชา..."
              style={{ width: "100%", height: "40px" }}
            >
              {subjectList.map((subject) => (
                <Option key={subject.Subject_id} value={subject.Subject_id}>
                  {subject.Subject_id} ({subject.Subject_name})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="ระบุตอนเรียน">
            <input
              className="input-student-section"
              placeholder="กรุณาระบุตอนเรียน..."
              value={section}
              onChange={(e) => setSection(e.target.value)}
              style={{
                width: "100%",
                height: "40px",
              }}
            />
          </Form.Item>
          <Form.Item label="Upload CSV">
            <Upload
              onChange={handleUpload}
              fileList={uploadedFileList}
              beforeUpload={() => false}
            >
              <Button
                style={{
                  width: "180px",
                  height: "40px",
                }}
                icon={<UploadOutlined />}
              >
                Click to Upload
              </Button>
            </Upload>
          </Form.Item>
          <Form.Item>
            <Button
              style={{
                marginTop: "10px",
                width: "180px",
                height: "40px",
              }}
              type="primary"
              onClick={handleAddToTable}
            >
              เพื่มรายชื่อนักศึกษา
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StudentFile;
