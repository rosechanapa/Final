import React, { useState } from "react";
import "../css/uploadExamsheet.css";
import { Button, Card, Upload, message, Progress, Empty } from "antd";
import { UploadOutlined, FilePdfOutlined } from "@ant-design/icons";
import Buttonupload from "../components/Button";
const UploadExamsheet = () => {
  const [fileList, setFileList] = useState([]);
  const [isSubmitDisabled, setIsSubmitDisabled] = useState(true);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null); // state สำหรับเก็บ URL ของไฟล์ PDF
  const [uploadProgress, setUploadProgress] = useState(0); // state สำหรับแสดงสถานะความคืบหน้า
  const [fileName, setFileName] = useState(null); // state สำหรับเก็บชื่อไฟล์

  const beforeUpload = (file) => {
    const isPDF = file.type === "application/pdf";
    if (!isPDF) {
      message.error("คุณสามารถอัปโหลดไฟล์ PDF เท่านั้น!");
    }
    return isPDF;
  };
  
  const props = {
    onRemove: (file) => {
      setFileList([]);
      setIsSubmitDisabled(true); // ปิดปุ่มยืนยันเมื่อไฟล์ถูกลบ
    },
    beforeUpload: (file) => {
      const isPDF = file.type === "application/pdf";
      if (isPDF) {
        setFileList([file]); // เพิ่มไฟล์ไปยัง fileList
        setIsSubmitDisabled(false); // เปิดปุ่มยืนยัน
      } else {
        message.error("คุณสามารถอัปโหลดไฟล์ PDF เท่านั้น!");
      }
      return false; // ไม่ให้อัปโหลดอัตโนมัติ
    },
    fileList,
    accept: ".pdf",
    listType: "text",
  };
  

  const handleChange = (info) => {
    console.log("File status:", info.file.status); // ตรวจสอบสถานะการอัปโหลด

    if (info.file.status === "uploading") {
      const progress = Math.round(info.file.percent || 0);
      setUploadProgress(progress); // อัปเดตความคืบหน้า
      console.log("Upload progress:", progress);
    }

    // เมื่อสถานะเป็น "done" ไฟล์ถูกอัปโหลดเรียบร้อย
    if (info.file.status === "done") {
      // ตรวจสอบว่าไฟล์ถูกตอบกลับมาจากเซิร์ฟเวอร์หรือไม่
      if (info.file.response) {
        setFileList([info.file]);
        setFileName(info.file.name);
        setPdfPreviewUrl(URL.createObjectURL(info.file.originFileObj));
        setUploadProgress(100);
        setIsSubmitDisabled(false);
        console.log("File uploaded:", info.file.name);
      } else {
        console.error("Error: No response from server");
      }
    }

    if (info.file.status === "removed") {
      setFileList([]);
      setPdfPreviewUrl(null);
      setUploadProgress(0);
      setFileName(null);
      setIsSubmitDisabled(true);
      console.log("File removed");
    }

    // หากมีข้อผิดพลาดระหว่างการอัปโหลด
    if (info.file.status === "error") {
      console.error("Error during upload:", info.file.error);
      setUploadProgress(0);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
  
    if (fileList.length === 0) {
      message.error("กรุณาอัปโหลดไฟล์ก่อนกด ยืนยัน");
      return;
    }
  
    const formData = new FormData();
    formData.append("file", fileList[0]);
  
    fetch("http://127.0.0.1:5000/uploadExamsheet", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          message.success("ไฟล์อัปโหลดสำเร็จ!");
          setPdfPreviewUrl(`http://127.0.0.1:5000/uploads/${data.filename}`);
        } else {
          message.error("เกิดข้อผิดพลาดในการอัปโหลดไฟล์");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        message.error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
      });
  };
  

  return (
    <div>
      <h1 className="Title">อัปโหลดกระดาษคำตอบ</h1>
      <Card
        title="อัปโหลดไฟล์กระดาษคำตอบที่ต้องการให้ระบบช่วยตรวจ"
        className="card-edit"
        style={{
          width: "100%",
          height: 600,
          margin: "0 auto",
        }}
      >
        <Upload
          accept=".pdf"
          beforeUpload={beforeUpload}
          onChange={handleChange}
          fileList={fileList}
          maxCount={1}
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
        {/* Progress bar แสดงความคืบหน้า */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <Progress percent={uploadProgress} status="active" />
        )}

        {/* แสดง Empty เมื่อไม่มีการอัปโหลดไฟล์ */}
        {!pdfPreviewUrl && (
          <Empty
            description="ไม่มีรายการไฟล์ที่อัปโหลด"
            style={{ marginTop: "20px" }}
          />
        )}

        {pdfPreviewUrl && (
          <iframe
            src={pdfPreviewUrl}
            style={{ width: "100%", height: "400px", marginTop: "20px" }}
            title="PDF Preview"
          ></iframe>
        )}

        <div className="button-wrapper-upload">
          <Buttonupload
            type="primary"
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