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
import { saveAs } from "file-saver";
import Papa from "papaparse";

const { Option } = Select;
const { Search } = Input;

const StudentFile = () => {
  const [students, setStudents] = useState([]); // เก็บข้อมูลนักศึกษา
  const [subjectId, setSubjectId] = useState("");
  const [section, setSection] = useState("");
  const [subjectList, setSubjectList] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [uploadedFileList, setUploadedFileList] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [sections, setSections] = useState([]);
  const [originalStudents, setOriginalStudents] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const [modalSubjectId, setModalSubjectId] = useState(""); // State ใหม่สำหรับ modal

  const handleSubjectChange = (value) => {
    setSubjectId(value);
    setSection("");
    setStudents([]);
    fetchSections(value);
    fetchStudents(value, "");
  };

  const handleSectionChange = (value) => {
    setSection(value);
    fetchStudents(subjectId, value);
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

          // ดึงข้อมูล sections และ students สำหรับ Subject_id แรก
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
    if (!subjectId) {
      message.error("กรุณาเลือกวิชา");
      return;
    }

    // สร้าง URL พร้อม Query Parameters
    const url = new URL("http://127.0.0.1:5000/get_students");
    url.searchParams.append("subjectId", subjectId);
    if (section) url.searchParams.append("section", section);

    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setStudents(data); // อัปเดต state
        setOriginalStudents(data);
      } else {
        const errorData = await response.json();
        message.error(errorData.error);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      message.error("เกิดข้อผิดพลาดในการดึงข้อมูลนักศึกษา");
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
        const errorData = await response.json();
        message.error(errorData.error);
        setSections([]); // รีเซ็ต sections
      }
    } catch (error) {
      console.error("Error fetching sections:", error);
      message.error("Failed to fetch sections.");
      setSections([]); // รีเซ็ต sections
    }
  };

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

  // // กำหนดคอลัมน์สำหรับ Table
  const columns = [
    {
      title: "Student ID",
      dataIndex: "Student_id",
      key: "Student_id",
      render: (text) => highlightText(text, searchValue),
      width: 150,
    },
    {
      title: "Full Name",
      dataIndex: "Full_name",
      key: "Full_name",
      render: (text) => highlightText(text, searchValue),
      width: 200,
    },
    {
      title: "Section",
      dataIndex: "Section",
      key: "Section",
      render: (text) => highlightText(text, searchValue),
      width: 80,
    },
    {
      title: "Total Score", // เพิ่มคอลัมน์นี้
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
        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          <Button2
            size="edit"
            // onClick={() => handleEdit(record)}
            style={{ marginRight: 10 }}
          >
            <EditIcon />
          </Button2>
          <Button2
            variant="danger"
            size="edit"
            // onClick={() => handleDelete(record.Student_id)}
          >
            <DeleteIcon />
          </Button2>
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

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
    columnWidth: 50,
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

      {/* <Card
        className="card-edit"
        style={{ width: "100%", height: 600, margin: "0 auto" }}
      > */}
      <Table
        rowSelection={rowSelection}
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

// const handleDelete = async (studentId) => {
//   try {
//     const response = await fetch(
//       `http://127.0.0.1:5000/delete_student/${studentId}`,
//       {
//         method: "DELETE",
//       }
//     );

//     if (response.ok) {
//       message.success("Student deleted successfully.");
//       setStudents((prev) =>
//         prev.filter((student) => student.Student_id !== studentId)
//       );
//     } else {
//       message.error("Failed to delete student.");
//     }
//   } catch (error) {
//     console.error("Error deleting student:", error);
//     message.error("Error deleting student.");
//   }
// };

// const handleEdit = (record) => {
//   setEditingStudent(record); // ตั้งค่าข้อมูลที่จะแก้ไข
//   setIsModalVisible(true);
// };

// const handleSaveEdit = async () => {
//   try {
//     const response = await fetch("http://127.0.0.1:5000/edit_student", {
//       method: "PUT",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(editingStudent),
//     });

//     if (response.ok) {
//       message.success("Student edited successfully.");
//       setStudents((prev) =>
//         prev.map((student) =>
//           student.Student_id === editingStudent.Student_id
//             ? editingStudent
//             : student
//         )
//       );
//       setIsModalVisible(false);
//       setEditingStudent(null);
//     } else {
//       message.error("Failed to edit student.");
//     }
//   } catch (error) {
//     console.error("Error editing student:", error);
//     message.error("Error editing student.");
//   }
// };
