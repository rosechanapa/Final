import "../css/viewExamsheet.css";
import { Table, Select, message, Modal } from "antd";
import React, { useState, useEffect } from "react";
import axios from "axios";
import Button from "../components/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import { PlusOutlined, MinusOutlined } from "@ant-design/icons";

const { Option } = Select;
const ViewRecheck = () => {
  const [subjectList, setSubjectList] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/get_subjects");
        const data = await response.json();
        console.log("Subjects Data:", data);
        setSubjectList(data);

        // ตั้งค่า subjectId เป็น Subject_id แรกที่เจอในตาราง
        if (data.length > 0) {
          setSubjectId(data[0].Subject_id);
        }
      } catch (error) {
        console.error("Error fetching subjects:", error);
      }
    };

    fetchSubjects();
  }, []);

  const handleSubjectChange = (value) => {
    setSubjectId(value);
  };

  //เป็น column ของ viewExamSheet ปรับชื่อหัวข้อใหม่ได้เลยย ฉันไม่รู้จะใส่ไร
  const columns = [
    {
      title: <div style={{ paddingLeft: "20px" }}>ไฟล์ที่</div>,
      //   dataIndex: "page_no",
      //   key: "page_no",
      width: 30,
      render: (text) => <div style={{ paddingLeft: "20px" }}>{text}</div>,
    },
    {
      title: "ตัวอย่างภาพ",
      dataIndex: "image_path",
      key: "image_path",
      width: 300,
      render: (text) => (
        <img
          // src={`http://127.0.0.1:5000/get_image_subject/${subjectId}/${text}`}
          // src={`http://127.0.0.1:5000/get_image_subject${text}`}
          src={`http://127.0.0.1:5000/get_image_subject/${subjectId}/${text
            .split("/")
            .pop()}`}
          alt="Example"
          className="show-img"
          //   onClick={() => handleImageClick(text)}
        />
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 150,
      render: (_, record) => (
        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            size="edit"
            varian="primary"
            // onClick={() => handleDownload(record.page_no)}
          >
            <DownloadIcon />
          </Button>
          {/* <Button
                variant="danger"
                size="edit"
                onClick={() => handleDelete(record.image_id)}
              >
                <DeleteIcon />
              </Button> */}
        </div>
      ),
    },
  ];
  return (
    <div>
      <h1 className="Title">กระดาษคำตอบที่ตรวจแล้ว</h1>
      <div className="input-group-view">
        <div className="dropdown-group-view">
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

        <div className="button-group-view">
          <Button
            variant="primary"
            size="view-btt"
            // onClick={handleDownloadPDF}
            style={{ display: "flex", alignItems: "center" }}
          >
            Download all
            <DownloadIcon style={{ fontSize: "18px", marginLeft: " 10px" }} />
          </Button>
          <Button
            variant="danger"
            size="view-btt"
            // onClick={handleDelete}
            style={{ display: "flex", alignItems: "center" }}
          >
            Delete all
            <DeleteIcon style={{ fontSize: "18px", marginLeft: "10px" }} />
          </Button>
        </div>
      </div>

      <Table
        // dataSource={imageList}
        columns={columns}
        rowKey="Page_id"
        pagination={{ pageSize: 5 }}
        className="custom-table"
      ></Table>
    </div>
  );
};

export default ViewRecheck;
