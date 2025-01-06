import React, { useState, useEffect } from "react";
import "../css/uploadExamsheet.css";
import { Button, Card, Upload, message, Progress, Empty, Select} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import Buttonupload from "../components/Button";
 
const { Option } = Select;  // กำหนด Option จาก Select

const UploadExamsheet = () => {
  const [fileList, setFileList] = useState([]);
  const [isSubmitDisabled, setIsSubmitDisabled] = useState(true);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null); // state สำหรับเก็บ URL ของไฟล์ PDF
  const [uploadProgress, setUploadProgress] = useState(0); // state สำหรับแสดงสถานะความคืบหน้า
  const [fileName, setFileName] = useState(""); // state สำหรับเก็บชื่อไฟล์

  const [subjectId, setSubjectId] = useState("");
  const [subjectList, setSubjectList] = useState([]);
  const [pageList, setPageList] = useState([]);
  const [pageNo, setPageNo] = useState("");

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

  useEffect(() => {
    const fetchPages = async () => {
      if (subjectId) {
        try {
          const response = await fetch(`http://127.0.0.1:5000/get_pages/${subjectId}`);
          const data = await response.json();
          setPageList(data);
        } catch (error) {
          console.error("Error fetching pages:", error);
        }
      } else {
        setPageList([]); // เคลียร์ dropdown เมื่อไม่ได้เลือก subjectId
      }
    };
  
    fetchPages();
  }, [subjectId]);
  
  const beforeUpload = (file) => {
    const isPDF = file.type === "application/pdf";
    if (isPDF) {
      setFileList([file]); // ตั้งค่า fileList ใหม่
      setIsSubmitDisabled(false);
      //message.success(`อัปโหลดไฟล์: ${file.name} สำเร็จ!`);
    } else {
      message.error("คุณสามารถอัปโหลดไฟล์ PDF เท่านั้น!");
    }
    return false; // ป้องกันการอัปโหลดอัตโนมัติ
  };

  const handleRemove = () => {
    setFileList([]); // ลบไฟล์ออกจากรายการ
    setIsSubmitDisabled(true);
    message.info("ลบไฟล์สำเร็จ");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!subjectId || !pageNo) {
      message.error("กรุณาเลือกรหัสวิชาและหน้ากระดาษคำตอบก่อนกด ยืนยัน");
      return;
    }

    if (fileList.length === 0) {
      message.error("กรุณาเลือกไฟล์ PDF ก่อนกด ยืนยัน");
      return;
    }

    const formData = new FormData();
    formData.append("file", fileList[0]); // ใช้ไฟล์แรกใน fileList
    formData.append("subject_id", subjectId);
    formData.append("page_no", pageNo);

    fetch("http://127.0.0.1:5000/uploadExamsheet", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          message.success("ไฟล์อัปโหลดสำเร็จ!");
          setFileList([]);
          setIsSubmitDisabled(true);
        } else {
          message.error(data.message || "เกิดข้อผิดพลาดในการอัปโหลดไฟล์");
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
          height: 800,
          margin: "0 auto",
        }}
      >
        <div className="input-container">
          <div className="input-group">
            <label className="label">รหัสวิชา:</label>
            <Select
              className="custom-select"
              value={subjectId || undefined}
              onChange={(value) => setSubjectId(value)}
              placeholder="กรุณาเลือกรหัสวิชา..."
              style={{ width: 340, height: 40 }}
            >
              {subjectList.map((subject) => (
                <Option key={subject.Subject_id} value={subject.Subject_id}>
                  {subject.Subject_id} ({subject.Subject_name})
                </Option>
              ))}
            </Select>
          </div>

          <div className="input-group">
            <label className="label">หน้ากระดาษคำตอบ:</label>
            <Select
              className="custom-select"
              value={pageNo || undefined}
              onChange={(value) => setPageNo(value)}
              placeholder="กรุณาเลือกหน้ากระดาษคำตอบ..."
              style={{ width: 340, height: 40 }}
            >
              {pageList.map((page) => (
                <Option key={page.page_no} value={page.page_no}>
                  หน้า {page.page_no}
                </Option>
              ))}
            </Select>
          </div>

        </div>
        <Upload
          beforeUpload={beforeUpload}
          fileList={fileList}
          onRemove={handleRemove} // ฟังก์ชันลบไฟล์
          maxCount={1}
          showUploadList={{
            showPreviewIcon: false, // ปิดไอคอนดูตัวอย่าง
            showRemoveIcon: true,   // แสดงไอคอนลบ
            showDownloadIcon: false, // ปิดไอคอนดาวน์โหลด
          }}
          className="upload-button"
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