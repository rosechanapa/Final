import React, { useState, useEffect } from "react";
import {
  Select,
  Input,
  Button,
  Card,
  Modal,
  Form,
  Upload,
  message,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import Button2 from "../components/Button";
import "../css/studentfile.css";

const { Option } = Select;
const { Search } = Input;

const StudentFile = () => {
  const [subjectId, setSubjectId] = useState("");
  const [section, setSection] = useState("");
  const [subjectList, setSubjectList] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [uploadedFileList, setUploadedFileList] = useState([]);

  // ดึงข้อมูลวิชาจาก backend
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

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleUpload = ({ fileList }) => {
    setUploadedFileList(fileList);
  };

  const handleAddToTable = async () => {
    if (!subjectId || !section || uploadedFileList.length === 0) {
      message.error("Please fill in all fields and upload a file.");
      return;
    }

    const formData = new FormData();
    formData.append("subjectId", subjectId);
    formData.append("section", section);
    formData.append("file", uploadedFileList[0].originFileObj);

    try {
      const response = await fetch("http://127.0.0.1:5000/csv_upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        message.success("Data submitted successfully.");
        setIsModalVisible(false);
        setUploadedFileList([]);
        setSection("");
      } else {
        const errorData = await response.json();
        message.error(`Failed to submit data: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Error submitting data:", error);
      message.error("Error submitting data.");
    }
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
            onChange={(value) => setSubjectId(value)}
            placeholder="เลือกวิชา..."
            style={{ width: 300, height: 40 }}
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
            value={subjectId || undefined}
            onChange={(value) => setSubjectId(value)}
            placeholder="เลือกตอนเรียน..."
            style={{ width: 250, height: 40 }}
          >
            {subjectList.map((subject) => (
              <Option key={subject.Subject_id} value={subject.Subject_id}>
                {subject.Subject_id} ({subject.Subject_name})
              </Option>
            ))}
          </Select>
        </div>
      </div>
      <div className="Search-Export-container">
        <Search
          className="custom-search"
          placeholder="Search..."
          allowClear
          onSearch={(value) => console.log(value)}
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

          <Button2 variant="light" size="sm" className="button-export">
            Export CSV
          </Button2>
        </div>
      </div>
      <Card
        className="card-edit"
        style={{ width: "100%", height: 600, margin: "0 auto" }}
      >
        <p>Card content</p>
      </Card>

      <Modal
        title="Add Student"
        visible={isModalVisible}
        footer={null}
        onCancel={() => setIsModalVisible(false)}
      >
        <Form layout="vertical">
          <Form.Item label="เลือกวิชา">
            <Select
              className="custom-select"
              value={subjectId || undefined}
              onChange={(value) => setSubjectId(value)}
              placeholder="กรุณาเลือกรหัสวิชา..."
              style={{ width: "100%" }}
            >
              {subjectList.map((subject) => (
                <Option key={subject.Subject_id} value={subject.Subject_id}>
                  {subject.Subject_id} ({subject.Subject_name})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="ระบุตอนเรียน">
            <Input
              placeholder="กรุณาระบุตอนเรียน"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Upload CSV">
            <Upload
              onChange={handleUpload}
              fileList={uploadedFileList}
              beforeUpload={() => false} // Prevent auto upload
            >
              <Button icon={<UploadOutlined />}>Click to Upload</Button>
            </Upload>
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleAddToTable}>
              เพื่มรายชื่อนักศึกษา
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StudentFile;
