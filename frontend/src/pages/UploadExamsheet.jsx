import React, { useState, useEffect } from "react";
import "../css/uploadExamsheet.css";
import { Button, Card, Upload, message, Select } from "antd";
import { UploadOutlined, FilePdfOutlined } from "@ant-design/icons";
import Buttonupload from "../components/Button";
import CloseIcon from "@mui/icons-material/Close";
const { Option } = Select;
const UploadExamsheet = () => {
  const [fileList, setFileList] = useState([]);
  const [isSubmitDisabled, setIsSubmitDisabled] = useState(true);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null); // state สำหรับเก็บ URL ของไฟล์ PDF
  const [uploadProgress, setUploadProgress] = useState(0); // state สำหรับแสดงสถานะความคืบหน้า
  //const [fileName, setFileName] = useState(null); // state สำหรับเก็บชื่อไฟล์ const [subjectList, setSubjectList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [pageNumbers, setPageNumbers] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
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

  const beforeUpload = (file) => {
    const isPDF = file.type === "application/pdf";
    if (!isPDF) {
      message.error("คุณสามารถอัปโหลดไฟล์ PDF เท่านั้น!");
    }
    return isPDF || Upload.LIST_IGNORE;
  };

  const handleChange = (info) => {
    console.log("File status:", info.file.status); // ตรวจสอบสถานะการอัปโหลด

    if (info.file.status === "uploading") {
      const progress = Math.round(info.file.percent || 0);
      setUploadProgress(progress); // อัปเดตความคืบหน้า
      console.log("Upload progress:", progress);
    }

    if (info.file.status === "done") {
      if (info.file.originFileObj) {
        setFileList([info.file]); // อัปเดต fileList
        setPdfPreviewUrl(URL.createObjectURL(info.file.originFileObj)); // สร้าง URL preview
        setIsSubmitDisabled(false); // เปิดใช้งานปุ่ม Submit
        console.log("File uploaded successfully:", info.file.name);
      } else {
        console.error("Error: No file object in upload response.");
      }
    }

    if (info.file.status === "removed") {
      setFileList([]);
      setPdfPreviewUrl(null);
      setUploadProgress(0);
      setIsSubmitDisabled(true); // ปิดใช้งานปุ่ม Submit
      console.log("File removed.");
    }

    if (info.file.status === "error") {
      console.error("Error during upload:", info.file.error);
      setUploadProgress(0);
    }
  };
  useEffect(() => {
    if (fileList.length > 0) {
      setIsSubmitDisabled(false); // เปิดปุ่ม Submit
    } else {
      setIsSubmitDisabled(true); // ปิดปุ่ม Submit
    }
  }, [fileList]);

  const props = {
    onRemove: (file) => {
      setFileList((prevList) =>
        prevList.filter((item) => item.uid !== file.uid)
      );
    },
    beforeUpload: (file) => {
      setFileList([...fileList, file]);
      return false;
    },
    fileList,
    onChange: handleChange,
    maxCount: 1,
    accept: ".pdf",
    listType: "text",
  };
  const handleRemoveFile = (uid) => {
    // ใช้ setFileList เพื่ออัปเดตรายการไฟล์ โดยกรองไฟล์ที่ไม่ต้องการลบออก
    setFileList((prevList) => prevList.filter((file) => file.uid !== uid));

    // Reset สถานะที่เกี่ยวข้องหากจำเป็น
    if (fileList.length === 1) {
      setIsSubmitDisabled(true); // Disable ปุ่มยืนยันหากไม่มีไฟล์
      setPdfPreviewUrl(null); // ลบการแสดงตัวอย่าง PDF หากไฟล์ถูกลบ
    }

    message.success("ลบไฟล์สำเร็จ");
  };
  const handleSubmit = (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("file", fileList[0]?.originFileObj);

    fetch("http://127.0.0.1:5000/uploadExamsheet", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          const pdfUrl = `http://127.0.0.1:5000/uploads/${data.filename}`;
          setPdfPreviewUrl(pdfUrl);
          alert("File uploaded successfully");
        } else {
          alert("Error uploading file");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  };
  const fetchPageNumbers = async (subjectId) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/get_pages/${subjectId}`
      );
      const data = await response.json();
      if (data.status === "success") {
        setPageNumbers(data.pages);
      } else {
        message.error(data.message);
      }
    } catch (error) {
      console.error("Error fetching page numbers:", error);
      message.error("Failed to fetch page numbers");
    }
  };
  const handleSubjectChange = (value) => {
    setSelectedSubject(value); // อัปเดตวิชาที่เลือก
    setPageNumbers([]); // รีเซ็ต pageNumbers ให้เป็นค่าว่าง
    setSelectedPage(null); // รีเซ็ตเพจที่เลือกให้เป็น null
    fetchPageNumbers(value); // ดึงข้อมูล Page_no ใหม่
  };
  useEffect(() => {
    setPageNumbers([]);
    setSelectedPage(null);
  }, [selectedSubject]);
  return (
    <div>
      <h1 className="Title">อัปโหลดกระดาษคำตอบ</h1>
      <Card
        title="อัปโหลดไฟล์กระดาษคำตอบที่ต้องการให้ระบบช่วยตรวจ"
        className="card-edit"
        style={{
          width: "100%",
          height: "700px",
          margin: "0 auto",
        }}
      >
        <div className="input-container">
          <div className="input-group">
            <label className="label">รหัสวิชา:</label>
            <Select
              className="custom-select"
              placeholder="เลือกวิชา..."
              style={{ width: 340, height: 40 }}
              onChange={handleSubjectChange}
            >
              {subjectList.map((subject) => (
                <Option key={subject.Subject_id} value={subject.Subject_id}>
                  {subject.Subject_id} ({subject.Subject_name})
                </Option>
              ))}
            </Select>
          </div>
          <div className="input-group">
            <label className="label">แผ่นที่:</label>
            <Select
              className="custom-select"
              placeholder="เลือกเลขแผ่น..."
              style={{ width: 340, height: 40 }}
              value={selectedPage || "all"} // ตั้งค่าเริ่มต้นเป็น "รวมทุกแผ่น"
              onChange={(value) => setSelectedPage(value)} // อัปเดตสถานะ selectedPage
              disabled={!selectedSubject} // ปิดการใช้งานดรอปดาวน์หากไม่มีวิชาเลือก
            >
              <Option key="all" value="all">
                รวมทุกแผ่น
              </Option>
              {pageNumbers.length > 0 ? (
                pageNumbers.map((page) => (
                  <Option key={page} value={page}>
                    แผ่นที่ {page}
                  </Option>
                ))
              ) : (
                <Option disabled value="no-data">
                  ไม่มีข้อมูลเพจ
                </Option>
              )}
            </Select>
          </div>
        </div>
        <div className="Upload-container">
          <Upload
            accept=".pdf"
            beforeUpload={beforeUpload}
            onChange={handleChange}
            fileList={fileList}
            maxCount={1}
            showUploadList={false}
            className="upload-button"
            {...props}
          >
            <Button
              className="upload"
              icon={<UploadOutlined />}
              style={{ fontSize: "32px", color: "#267fd7" }}
            >
              <div className="font-position">
                <h1 className="head-title">อัปโหลดไฟล์กระดาษคำตอบ</h1>
                <h1 className="sub-title">รองรับไฟล์ PDF</h1>
              </div>
            </Button>
          </Upload>
        </div>

        <div
          className="uploaded-file-list"
          style={{
            marginTop: "40px",
          }}
        >
          {fileList.length > 0 && (
            <ul style={{ width: "500px" }}>
              {fileList.map((file) => (
                <li key={file.uid} className="uploaded-file-item">
                  <div>
                    <FilePdfOutlined className="uploaded-file-item-icon" />
                    {file.name}
                  </div>
                  <CloseIcon
                    className="uploaded-file-item-remove"
                    onClick={() => handleRemoveFile(file.uid)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* {uploadProgress > 0 && uploadProgress < 100 && (
          <Progress percent={uploadProgress} status="active" />
        )} */}

        {/* {!pdfPreviewUrl && fileList.length === 0 && (
          <Empty
            description="ไม่มีรายการไฟล์ที่อัปโหลด"
            style={{ marginTop: "20px" }}
          />
        )} */}

        <div className="button-wrapper-upload">
          <Buttonupload
            variant="primary"
            disabled={isSubmitDisabled}
            onClick={handleSubmit}
          >
            ยืนยัน
          </Buttonupload>
        </div>
      </Card>
    </div>
  );
};

export default UploadExamsheet;