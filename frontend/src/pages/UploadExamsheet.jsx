import React, { useState, useEffect, useMemo, useCallback } from "react";
import "../css/uploadExamsheet.css";
import {
  Button,
  Card,
  Upload,
  message,
  Select,
  Tabs,
  Table,
  Progress,
  Spin,
  Modal,
} from "antd";
import { UploadOutlined, FilePdfOutlined } from "@ant-design/icons";
import Buttonupload from "../components/Button";
import CloseIcon from "@mui/icons-material/Close";
import Button2 from "../components/Button";
import { io } from "socket.io-client";

const { Option } = Select; // กำหนด Option จาก Select
// const { TabPane } = Tabs;
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
  const [loading, setLoading] = useState(false);
  const [isAnyProgressVisible, setIsAnyProgressVisible] = useState(false); // ควบคุมปุ่มทั้งหมด
  const [progressVisible, setProgressVisible] = useState({}); // ควบคุม Progress bar รายการเดียว
  const [selectedId, setSelectedId] = useState(null);
  const [selectedPage, setSelectedPage] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const socket = useMemo(() => {
    return io("http://127.0.0.1:5000");
  }, []);

  // เมื่อ component mount ครั้งแรก ให้สมัคร event listener ไว้
  useEffect(() => {
    // รับ event "score_updated" จากฝั่งเซิร์ฟเวอร์
    socket.on("score_updated", (data) => {
      console.log("Received score_updated event:", data);

      fetchExamSheets();
    });

    // cleanup เมื่อ component unmount
    return () => {
      socket.off("score_updated");
    };
  }, [socket]);

  // ฟังก์ชันดึงข้อมูล sheets (GET /get_sheets)
  const fetchExamSheets = useCallback(async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/get_sheets");
      const data = await response.json();
      console.log("Fetched Sheets Data:", data);
      setExamSheets(data);
    } catch (error) {
      console.error("Error fetching exam sheets:", error);
    }
  }, []);

  // เรียก fetchExamSheets เมื่อ component mount ครั้งแรก
  useEffect(() => {
    fetchExamSheets();
  }, [fetchExamSheets]);

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
        setPageList([]);
      }
    };

    fetchPages();
  }, [subjectId]);

  const handleSendData = async (subjectId, pageNo) => {
    setSelectedId(subjectId);
    setSelectedPage(pageNo);
    setProgressVisible((prev) => ({
      ...prev,
      [`${subjectId}-${pageNo}`]: true,
    }));
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
        message.success("เริ่มประมวลผลแล้ว!");
      } else {
        message.error(data.message || "เกิดข้อผิดพลาดในการส่งข้อมูล");
      }
    } catch (error) {
      console.error("Error sending data:", error);
      message.error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false); // ปิดสถานะ loading เมื่อเสร็จสิ้น
    }
  };
  useEffect(() => {
    const currentSheet = examSheets.find(
      (item) => item.id === selectedId && item.page === selectedPage
    );

    if (currentSheet) {
      const [gradedCount, totalCount] = currentSheet.total
        .split("/")
        .map(Number);
      if (gradedCount === totalCount && totalCount !== 0) {
        handleStop();
      }
    }
  }, [examSheets, selectedId, selectedPage]);
  const handleStop = async () => {
    const hideLoading = message.loading("กำลังทำการหยุด กรุณารอสักครู่...", 0);
    // parameter 0 หมายถึงไม่ให้ auto-close จนกว่าเราจะสั่งปิดเอง

    try {
      // เรียก API /stop_process แบบ POST
      const response = await fetch("http://127.0.0.1:5000/stop_process", {
        method: "POST",
      });
      const data = await response.json();

      // ปิด loading เดิม
      hideLoading();

      if (data.success) {
        // แสดงข้อความสำเร็จ
        message.info("หยุดการทำงานสำเร็จ");
      } else {
        message.error("ไม่สามารถหยุดการทำงานได้");
      }
    } catch (error) {
      // ถ้ามี error ก็ปิด loading แล้วแจ้ง error
      hideLoading();
      console.error("Error calling stop_process:", error);
      message.error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    }

    // หลังจากเรียก API แล้ว จัดการ state ใน React เหมือนเดิม
    setProgressVisible({}); // รีเซ็ต progressVisible ให้ไม่มีการแสดง Progress ใดๆ
    setIsAnyProgressVisible(false); // เปิดใช้งานปุ่มทุกแถวใน Table
    setSelectedId(null);
    setSelectedPage(null);
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
    // message.info("ลบไฟล์สำเร็จ");
  };

  const handleRemoveFile = (uid) => {
    setFileList((prevList) => prevList.filter((file) => file.uid !== uid));

    if (fileList.length === 1) {
      setIsSubmitDisabled(true);
      setPdfPreviewUrl(null);
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

  const handleDeleteFile = async (subjectId, pageNo) => {
    const hideLoading = message.loading("กำลังลบไฟล์...", 0);

    try {
      const response = await fetch("http://127.0.0.1:5000/delete_file", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject_id: subjectId, page_no: pageNo }),
      });

      const data = await response.json();
      hideLoading();

      if (data.success) {
        message.success("ลบไฟล์สำเร็จ");
        // ดึงข้อมูลใหม่หลังลบ
        fetchExamSheets();
      } else {
        message.error(data.message || "เกิดข้อผิดพลาดในการลบไฟล์");
      }
    } catch (error) {
      hideLoading();
      console.error("Error deleting file:", error);
      message.error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    }
  };
  const handleDeletePaper = async ({ Subject_id, Page_no, Sheet_id }) => {
    try {
      const response = await fetch("http://127.0.0.1:5000/delete_paper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ Subject_id, Page_no, Sheet_id }),
      });

      const result = await response.json();

      if (response.ok) {
        message.success(result.message || "ลบข้อมูลสำเร็จ");

        // อัปเดต state โดยลบแผ่นงานที่ถูกลบออกจาก sheets
        setSheets(sheets.filter((sheet) => sheet.Sheet_id !== Sheet_id));
        setCurrentIndex((prevIndex) => Math.max(prevIndex - 1, 0));

        fetchExamSheets();
      } else {
        message.error(result.error || "เกิดข้อผิดพลาดในการลบข้อมูล");
      }
    } catch (error) {
      message.error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    }
  };

  const handleShowModal = async (pageId) => {
    setSelectedPageId(pageId);
    setIsModalVisible(true);

    // เรียก API เพื่อดึงข้อมูล Sheet
    const response = await fetch("http://127.0.0.1:5000/find_paper", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ Page_id: pageId }),
    });
    const data = await response.json();
    setSheets(data);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSheets([]);
    setCurrentIndex(0);
  };

  const handleNext = () => {
    if (currentIndex < sheets.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const columns = [
    {
      title: <div style={{ paddingLeft: "20px" }}>รหัสวิชา</div>,
      dataIndex: "id",
      key: "id",
      width: 200,
      render: (text) => <div style={{ paddingLeft: "20px" }}>{text}</div>,
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
      width: 150,
      render: (_, record) => {
        const [gradedCount, totalCount] = record.total
          .split("/")
          .map((v) => parseInt(v));
        return gradedCount < totalCount ? ( // ตรวจสอบเงื่อนไข หากยังไม่ตรวจครบทุกแผ่น
          <>
            <Button
              type="primary"
              onClick={() => handleSendData(record.id, record.page)}
              disabled={isAnyProgressVisible} // ปิดการใช้งานปุ่มทั้งหมดระหว่างดำเนินการ
            >
              ทำนาย
            </Button>
            <Button type="primary" danger disabled={isAnyProgressVisible}>
              ดูกระดาษ
            </Button>
          </>
        ) : (
          <>
            <span style={{ color: "#1a9c3d" }}>Complete</span>
            <Button
              onClick={() => handleShowModal(record.Page_id)}
              disabled={isAnyProgressVisible}
            >
              ดูกระดาษ
            </Button>
          </>
        );
      },
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
        onRemove={handleRemove}
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
      {loading && (
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Spin size="large" tip="กำลังประมวลผล... โปรดรอสักครู่" />
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginBottom: "20px",
        }}
      >
        {selectedId &&
          selectedPage &&
          progressVisible[`${selectedId}-${selectedPage}`] && (
            <>
              {/* แสดงข้อความแนวตั้ง */}
              <h1 className="title-predict" style={{ marginBottom: "10px" }}>
                {(() => {
                  const currentSheet = examSheets.find(
                    (item) =>
                      item.id === selectedId && item.page === selectedPage
                  );
                  return currentSheet
                    ? `วิชา: ${currentSheet.subject} หน้า: ${currentSheet.page}`
                    : "ข้อมูลไม่พบ";
                })()}
              </h1>

              {/* แสดง Progress และปุ่ม Stop ในแนวนอน */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center", // จัดให้อยู่กลางแนวตั้ง
                  gap: "10px", // ระยะห่างระหว่าง Progress และปุ่ม
                }}
              >
                <Progress
                  status="active"
                  percent={(() => {
                    console.log("ExamSheets:", examSheets); // ดูว่ามีข้อมูลอะไรใน ExamSheets
                    console.log(
                      "Selected ID:",
                      selectedId,
                      "Selected Page:",
                      selectedPage
                    );
                    const currentSheet = examSheets.find(
                      (item) =>
                        item.id === selectedId && item.page === selectedPage
                    );
                    console.log("Current Sheet in Progress:", currentSheet);
                    if (currentSheet) {
                      const [gradedCount, totalCount] = currentSheet.total
                        .split("/")
                        .map((v) => parseInt(v));
                      return (gradedCount / totalCount) * 100; // คำนวณความยาวแถบตามสัดส่วน
                    }
                    return 0;
                  })()}
                  format={() => {
                    const currentSheet = examSheets.find(
                      (item) =>
                        item.id === selectedId && item.page === selectedPage
                    );
                    return currentSheet ? currentSheet.total : "0/0"; // แสดงเป็นข้อความ "x/y"
                  }}
                  style={{ flex: "1" }}
                />
                <Button
                  type="primary"
                  danger
                  onClick={handleStop}
                  style={{ flexShrink: 0 }}
                >
                  Stop
                </Button>
              </div>
            </>
          )}
      </div>
      <Table
        columns={columns}
        dataSource={examSheets}
        className="custom-table"
        rowKey={(record) => record.Page_id}
      />
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
          items={[
            {
              label: (
                <Button2
                  variant={activeTab === "1" ? "primary" : "light-disabled"}
                  size="custom"
                >
                  อัปโหลดกระดาษคำตอบ
                </Button2>
              ),
              key: "1",
              children: renderUploadTab(), // เนื้อหาของ Tab "อัปโหลดกระดาษคำตอบ"
            },
            {
              label: (
                <Button2
                  variant={activeTab === "2" ? "primary" : "light-disabled"}
                  size="custom"
                  onClick={() => fetchExamSheets()}
                >
                  ทำนายกระดาษคำตอบ
                </Button2>
              ),
              key: "2",
              children: renderPredictionTab(), // เนื้อหาของ Tab "ทำนายกระดาษคำตอบ"
            },
          ]}
        />
      </Card>
      <Modal
        title="แสดงภาพแผ่นงาน"
        visible={isModalVisible}
        onCancel={handleCloseModal}
        footer={null}
      >
        {sheets.length > 0 ? (
          <div style={{ textAlign: "center", position: "relative" }}>
            {/* Overlay สำหรับแสดงเลขหน้า */}
            <div
              style={{
                position: "absolute",
                top: "10px",
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                color: "white",
                padding: "5px 10px",
                borderRadius: "8px",
                fontSize: "14px",
                zIndex: 2, // ให้ข้อความอยู่ด้านหน้าสุด
              }}
            >
              หน้า {currentIndex + 1} / {sheets.length}
            </div>
            <Button
              type="primary"
              danger
              onClick={() =>
                handleDeletePaper({
                  Subject_id: sheets[currentIndex].Subject_id,
                  Page_no: sheets[currentIndex].Page_no,
                  Sheet_id: sheets[currentIndex].Sheet_id,
                })
              }
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                zIndex: 2,
              }}
            >
              ลบกระดาษ
            </Button>
            {/* รูปภาพ */}
            <img
              src={`http://127.0.0.1:5000/images/${sheets[currentIndex].Subject_id}/${sheets[currentIndex].Page_no}/${sheets[currentIndex].Sheet_id}`}
              alt="Sheet"
              style={{
                width: "100%",
                maxHeight: "400px",
                objectFit: "contain",
                marginTop: "50px", // เพิ่มระยะห่างด้านบน
              }}
            />
            {/* ข้อความแสดงสถานะ */}
            <p style={{ marginTop: "10px", fontSize: "16px" }}>
              {sheets[currentIndex].is_answered ? (
                <span style={{ color: "gray" }}>ทำนายแล้ว</span>
              ) : (
                <span style={{ color: "blue" }}>ยังไม่ทำนาย</span>
              )}
            </p>
            {/* ปุ่มเลื่อนหน้า */}
            <div style={{ marginTop: "20px" }}>
              <Button onClick={handlePrevious} disabled={currentIndex === 0}>
                ก่อนหน้า
              </Button>
              <Button
                onClick={handleNext}
                disabled={currentIndex === sheets.length - 1}
              >
                ถัดไป
              </Button>
            </div>
          </div>
        ) : (
          <p>กำลังโหลดข้อมูล...</p>
        )}
      </Modal>
    </div>
  );
};

export default UploadExamsheet;
