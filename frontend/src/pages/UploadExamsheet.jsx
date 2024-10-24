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
    return isPDF || Upload.LIST_IGNORE;
  };

  const handleChange = (info) => {
    console.log("File status:", info.file.status); // ตรวจสอบสถานะการอัปโหลด

    // เมื่อสถานะเป็น "uploading" แสดงความคืบหน้า
    if (info.file.status === "uploading") {
      const progress = Math.round(info.file.percent || 0);
      setUploadProgress(progress); // อัปเดตความคืบหน้า
      console.log("Upload progress:", progress);
    }

    // เมื่อสถานะเป็น "done" ไฟล์ถูกอัปโหลดเรียบร้อย
    if (info.file.status === "done") {
      // ตรวจสอบว่าไฟล์ถูกตอบกลับมาจากเซิร์ฟเวอร์หรือไม่
      if (info.file.response) {
        setFileList([info.file]); // เก็บไฟล์ที่อัปโหลดใน state
        setFileName(info.file.name); // เก็บชื่อไฟล์
        setPdfPreviewUrl(URL.createObjectURL(info.file.originFileObj)); // สร้าง URL สำหรับ preview PDF
        setUploadProgress(100); // ตั้งค่าสถานะการอัปโหลดเสร็จสิ้น
        setIsSubmitDisabled(false); // เปิดใช้งานปุ่ม submit
        console.log("File uploaded:", info.file.name);
      } else {
        console.error("Error: No response from server");
      }
    }

    // เมื่อสถานะเป็น "removed" ลบไฟล์ออกจาก state
    if (info.file.status === "removed") {
      setFileList([]); // ลบไฟล์ออกจาก state
      setPdfPreviewUrl(null); // ลบ URL เมื่อไฟล์ถูกลบ
      setUploadProgress(0); // รีเซ็ตความคืบหน้า
      setFileName(null); // รีเซ็ตชื่อไฟล์
      setIsSubmitDisabled(true); // ปิดใช้งานปุ่ม submit
      console.log("File removed");
    }

    // หากมีข้อผิดพลาดระหว่างการอัปโหลด
    if (info.file.status === "error") {
      console.error("Error during upload:", info.file.error);
      setUploadProgress(0); // รีเซ็ตความคืบหน้าในกรณีที่อัปโหลดล้มเหลว
    }
  };

  const props = {
    onRemove: (file) => {
      setFileList((prevList) =>
        prevList.filter((item) => item.uid !== file.uid)
      );
    },
    beforeUpload: (file) => {
      setFileList([...fileList, file]);
      return false; // ป้องกันการอัปโหลดทันที
    },
    fileList,
    onChange: handleChange,
    maxCount: 1, // จำกัดจำนวนไฟล์
    accept: ".pdf",
    listType: "text", // แสดงชื่อไฟล์ที่เลือก
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

        {/* แสดง PDF ที่อัปโหลดแล้ว
        {pdfPreviewUrl && (
          <iframe
            src={pdfPreviewUrl}
            style={{ width: "100%", height: "400px", marginTop: "20px" }}
            title="PDF Preview"
          ></iframe>
        )} */}
        <div className="button-wrapper-upload">
          <Buttonupload
            type="primary"
            disabled={isSubmitDisabled}
            onClick={handleSubmit}
          >
            Submit
          </Buttonupload>
        </div>
      </Card>
    </div>
  );
};

export default UploadExamsheet;
