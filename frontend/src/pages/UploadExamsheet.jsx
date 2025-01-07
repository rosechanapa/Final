import React, { useState, useEffect } from "react";
import "../css/uploadExamsheet.css";
import { Button, Card, Upload, message, Select, Tabs, Table, Progress } from "antd";
import { UploadOutlined, FilePdfOutlined } from "@ant-design/icons";
import Buttonupload from "../components/Button";
import CloseIcon from "@mui/icons-material/Close";
import Button2 from "../components/Button";

const { Option } = Select; // กำหนด Option จาก Select
const { TabPane } = Tabs;
const UploadExamsheet = () => {
  const [fileList, setFileList] = useState([]);
  const [isSubmitDisabled, setIsSubmitDisabled] = useState(true);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null); // state สำหรับเก็บ URL ของไฟล์ PDF
  const [activeTab, setActiveTab] = useState("1");

  const [subjectId, setSubjectId] = useState("");
  const [subjectList, setSubjectList] = useState([]);
  const [pageList, setPageList] = useState([]);
  const [pageNo, setPageNo] = useState("");

  const [examSheets, setExamSheets] = useState([]);
  
  const [isAnyProgressVisible, setIsAnyProgressVisible] = useState(false); // ควบคุมปุ่มทั้งหมด
  const [progressVisible, setProgressVisible] = useState({}); // ควบคุม Progress bar รายการเดียว
  const [selectedId, setSelectedId] = useState(null);
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

  useEffect(() => {
    const fetchPages = async () => {
      if (subjectId) {
        try {
          const response = await fetch(
            `http://127.0.0.1:5000/get_pages/${subjectId}`
          );
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

  useEffect(() => {
    const fetchExamSheets = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/get_sheets");
        const data = await response.json();
        setExamSheets(data);
      } catch (error) {
        console.error("Error fetching exam sheets:", error);
      }
    };
  
    fetchExamSheets();
  }, []);

  

  const handleSendData = async (subjectId, pageNo) => {
    setSelectedId(subjectId);
    setSelectedPage(pageNo);
    setProgressVisible((prev) => ({ ...prev, [`${subjectId}-${pageNo}`]: true }));
    setIsAnyProgressVisible(true); // ปิดทุกปุ่มเมื่อเริ่มส่งข้อมูล

    try {
      const response = await fetch("http://127.0.0.1:5000/start_predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject_id: subjectId, page_no: pageNo }),
      });
      const data = await response.json();
      if (data.success) {
        message.success("ส่งข้อมูลสำเร็จ!");
      } else {
        message.error(data.message || "เกิดข้อผิดพลาดในการส่งข้อมูล");
      }
    } catch (error) {
      console.error("Error sending data:", error);
      message.error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    }
  };

  const handleStop = () => {
    setProgressVisible({}); // รีเซ็ต progressVisible ให้ไม่มีการแสดง Progress ใดๆ
    setIsAnyProgressVisible(false); // เปิดใช้งานปุ่มทุกแถวใน Table
    setSelectedId(null);
    setSelectedPage(null);
    message.info("หยุดการทำงานสำเร็จ");
  };
  
  

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
    //message.info("ลบไฟล์สำเร็จ");
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
    formData.append("page_no", pageNo === "allpage" ? "allpage" : pageNo); // ส่ง "allpage" หากเลือกตัวเลือกทุกหน้า

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


  const columns = [
    {
      title: <div style={{ paddingLeft: "20px" }}>รหัสวิชา</div>,
      dataIndex: "id",
      key: "id",
      width: 150,
    },
    {
      title: "ชื่อวิชา",
      dataIndex: "subject",
      key: "subject",
      width: 300,
    },
    {
      title: "หน้า",
      dataIndex: "page",
      key: "page",
      width: 100,
    },
    {
      title: "จำนวนแผ่นที่ทำนาย",
      dataIndex: "total",
      key: "total",
      width: 150,
    },
    {
      title: "Action",
      key: "action",
      width: 100,
      render: (_, record) => (
        <Button
          type="primary"
          onClick={() => handleSendData(record.id, record.page)}
          disabled={isAnyProgressVisible} // ควบคุมการปิดการใช้งานปุ่มทุกแถว
        >
          ทำนาย
        </Button>
      ),
    },    
  ];  


  const renderUploadTab = () => (
    <div>
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
            <Option key="allpage" value="allpage">
              ทุกหน้า (All Pages)
            </Option>
          </Select>
        </div>
      </div>
      <Upload
        beforeUpload={beforeUpload}
        fileList={fileList}
        onRemove={handleRemove} // ฟังก์ชันลบไฟล์
        maxCount={1}
        showUploadList={false}
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
      <div className="button-wrapper-upload">
        <Buttonupload
          type="primary"
          disabled={isSubmitDisabled}
          onClick={handleSubmit}
        >
          ยืนยัน
        </Buttonupload>
      </div>
    </div>
  );



  const renderPredictionTab = () => (
    <div>
      <h1 className="head-title-predict">ตารางรายการไฟล์ที่ต้องทำนาย</h1>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        {selectedId && selectedPage && progressVisible[`${selectedId}-${selectedPage}`] && (
          <>
            <Progress percent={50} status="active" style={{ flex: "1" }} />
            <Button
              type="primary"
              danger
              onClick={handleStop} // ปุ่มหยุด
              style={{ flexShrink: 0 }}
            >
              Stop
            </Button>
          </>
        )}
      </div>
      <Table
        columns={columns}
        dataSource={examSheets}
        className="custom-table"
        rowKey={(record) => record.Page_id} // ใช้ Page_id เป็น unique key
      ></Table>

    </div>
  );

  return (
    <div>
      <h1 className="Title">อัปโหลดกระดาษคำตอบ</h1>
      <Card
        className="card-edit"
        style={{
          width: "100%",
          minHeight: 700,
          margin: "0 auto",
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          centered
        >
          <TabPane
            tab={
              <Button2
                variant={activeTab === "1" ? "primary" : "light-disabled"}
                size="custom"
              >
                อัปโหลดกระดาษคำตอบ
              </Button2>
            }
            key="1"
          >
            {renderUploadTab()}
          </TabPane>
          <TabPane
            tab={
              <Button2
                variant={activeTab === "2" ? "primary" : "light-disabled"}
                size="custom"
              >
                ทำนายกระดาษคำตอบ
              </Button2>
            }
            key="2"
          >
            {renderPredictionTab()}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default UploadExamsheet;