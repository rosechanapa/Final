import React, { useState } from "react";
import "../../css/createExamsheet.css";
import { Card, Select } from "antd";
import Button from "../../components/Button";
import ReplayIcon from "@mui/icons-material/Replay";
import { Modal } from "antd";
import { ExclamationCircleFilled } from "@ant-design/icons";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
 

function MainApp({ subjectId, pageNumber, imageSrc, onReset }) {
  const [step, setStep] = useState(1);
  const [selectedCase, setSelectedCase] = useState('');
  const [rangeInput, setRangeInput] = useState('');
  const [finalImageSrc, setFinalImageSrc] = useState(imageSrc);
  const [typeInput, setTypeInput] = useState('');  

  const { Option } = Select;
 
  const handleCaseSelect = (value) => {
    setSelectedCase(value);
    setRangeInput('');
    setTypeInput('');
  };
  

  const handleGenerate = async () => {
    const response = await fetch('http://127.0.0.1:5000/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        selected_case: selectedCase,
        range_input: rangeInput,
        type_input: typeInput,  
      }),
    });
  
    if (response.ok) {
      const data = await response.json();
      setFinalImageSrc(`data:image/png;base64,${data.image}`);

      if (data.status === "Reached max height") {
        Modal.warning({
          title: "เพิ่มจำนวนข้อสูงสุดได้แค่นี้ !",
          content:
            "หากคุณต้องการเพิ่มจำนวนข้ออีก กรุณาสร้างกระดาษคำตอบแผ่นใหม่", // ข้อความใน Modal
          okText: "ตกลง", // ข้อความในปุ่ม
          width: 550,
          className: "custom-modal",
        });
      }

      setStep(2);
    } else {
      console.error('Failed to generate image');
    }
  };

  const handleExit = async () => {
    Modal.confirm({
      title: "ต้องการสร้างกระดาษคำตอบใหม่หรือไม่ ?",
      icon: <ExclamationCircleFilled />,
      content: "เมื่อกดตกลงแล้ว กระดาษคำตอบที่คุณเพิ่งสร้างจะถูกลบ",
      width: 550,
      className: "custom-modal",
      okText: "ตกลง",
      cancelText: "ยกเลิก",
      onOk: async () => {
        try {
          const response = await fetch("http://127.0.0.1:5000/reset", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            console.log("Reset successful");
            onReset();
          } else {
            console.error("Reset failed");
          }
        } catch (error) {
          console.error("Error during reset:", error);
        }
      },
      onCancel() {
        console.log("Cancelled");
      },
    });
  };

  const handleGenerateAgain = async () => {
    setSelectedCase('');
    setRangeInput('');
    setTypeInput(''); 
    setStep(1);
  };
 
  const handleFinish = async () => {
    setStep(3); // ย้ายไป Step 3 ทันทีหลังจากกดปุ่ม
  
    try {
      const response = await fetch('http://127.0.0.1:5000/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
  
      if (response.ok) {
        console.log('Reset successful');
      } else {
        console.error('Reset failed');
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };
  

  const handleDownload = (imageSrc) => {
    const link = document.createElement("a");
    link.href = imageSrc;
    link.download = "answer_sheet.png"; // ชื่อไฟล์ที่จะดาวน์โหลด
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <h1 className="Title">สร้างกระดาษคำตอบ</h1>
      <Card
        className="card-edit"
        style={{
          width: "100%",
          height: step === 2 || step === 3 ? "auto" : "600px",
          margin: "0px auto",
        }}
      >
        <div className="card-wrapper">
          <h1 className="ant-card-head-title2">
            สร้างกระดาษคำตอบที่นี่ ( รองรับรูปแบบกระดาษ A4 ในแนวตั้งเท่านั้น )
          </h1>

          <div className="button-wrapper">
            {(step === 2 || step === 1) && (
              <Button
                className="Generatagain"
                variant="light"
                size="sm"
                onClick={handleExit}
              >
                <ReplayIcon style={{ fontSize: "21px", marginRight: 8 }} />{" "}
                สร้างใหม่อีกครั้ง
              </Button>
            )}

            {step === 3 && (
              <Button
                variant="light"
                size="sm"
                onClick={() => handleDownload(finalImageSrc)}
              >
                <FileDownloadIcon
                  style={{ fontSize: "21px", marginRight: 8 }}
                />{" "}
                ดาวน์โหลด
              </Button>
            )}
          </div>
        </div>

        {step === 1 && (
          <div className="condition-container">
            <div className="condition-group">
              <div className="input-group">
                <h1 className="label">เงื่อนไข : </h1>
                <Select
                  value={selectedCase || undefined}
                  onChange={handleCaseSelect}
                  className="custom-select"
                  placeholder="กรุณาเลือกเงื่อนไข..."
                  style={{
                    width: 340,
                    height: 40,
                  }}
                >
                  <Option value="Case1">1 digit </Option>
                  <Option value="Case2">2 digit</Option>
                  <Option value="Case3">Long box </Option>
                  <Option value="Case4">True or False</Option>
                </Select>
              </div>
              <div className="input-group">
                <h1 className="label">เพิ่มจำนวนข้อ : </h1>
                <input
                  type="text"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  className="input-box"
                />
              </div>
            </div>
            <div className="condition-group">
              <div className="input-group">
                <h1 className="label">รูปแบบคะแนน : </h1>
                <Select
                  className="custom-select"
                  placeholder="กรุณาเลือกรูปแบบคะแนน..."
                  style={{ width: 340, height: 40 }}
                >
                  <Option value="number">Single Point</Option>
                  <Option value="character">Group Point</Option>
                </Select>
              </div>

              {selectedCase === "Case1" && (
                <div className="input-group">
                  <h1 className="label">ตัวเลือก : </h1>
                  <Select
                    value={typeInput || undefined}
                    onChange={(value) => setTypeInput(value)}
                    className="custom-select"
                    placeholder="กรุณาเลือกตัวเลือก..."
                    style={{ width: 340, height: 40 }}
                  >
                    <Option value="number">ตัวเลข</Option>
                    <Option value="character">ตัวอักษร</Option>
                  </Select>
                </div>
              )}
              
            </div>
            <div className="Button-container">
              <Button variant="primary" size="md" onClick={handleGenerate}>
                สร้าง
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={finalImageSrc}
              alt="Generated"
              style={{
                width: "50%",
                margin: "30px auto",
                borderRadius: 8,
                boxShadow: "0px 2px 2px 3px rgba(208, 216, 238, 0.35)",
              }}
            />
            <div className="Buttoncase2-container">
              <Button variant="light" size="md" onClick={handleGenerateAgain}>
                เพิ่มจำนวนข้อ
              </Button>
              <Button variant="primary" size="md" onClick={handleFinish}>
                เสร็จสิ้น
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={finalImageSrc}
              alt="Generated"
              style={{
                width: "50%",
                margin: "30px auto",
                borderRadius: 8,
                boxShadow: "0px 2px 2px 3px rgba(208, 216, 238, 0.35)",
              }}
            />

            <Button variant="primary" size="md">
              เพิ่มเฉลย
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default MainApp;