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

      <div className="input-group">
        <label className="label">รหัสวิชา:</label>
        <Select
          className="custom-select"
          value={subjectId || undefined}
          onChange={(value) => setSubjectId(value)}
          placeholder="กรุณาเลือกรหัสวิชา..."
          style={{ width: 300, height: 40 }}
        >
          {subjectList.map((subject) => (
            <Option key={subject.Subject_id} value={subject.Subject_id}>
              {subject.Subject_id} ({subject.Subject_name})
            </Option>
          ))}
        </Select>

        <Search
          className="custom-search"
          placeholder="ค้นหา รหัสนักศึกษา"
          allowClear
          onSearch={(value) => console.log(value)}
          style={{ width: 350 }}
        />

        <Button
          type="primary"
          className="button_add"
          style={{ height: 40 }}
          onClick={showModal}
        >
          Add Student
        </Button>

        <Button type="primary" className="button_export" style={{ height: 40 }}>
          Export CSV
        </Button>
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
        footer={null} // Removed default Ok and Cancel buttons
        onCancel={() => setIsModalVisible(false)}
      >
        <Form layout="vertical">
          <Form.Item label="Selected Subject">
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
          <Form.Item label="Section">
            <Input
              placeholder="Enter section"
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
              Add to Table
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StudentFile;
