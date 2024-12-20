import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom"; // นำเข้า useNavigate
import { Card, Select, Modal } from "antd"; // นำเข้า Select
import "../../css/createExamsheet.css";
import Button from "../../components/Button";
import { ExclamationCircleFilled } from "@ant-design/icons";
import EditIcon from "@mui/icons-material/Edit";
import Customize from "../createSheet/Modal/Customize";
const { Option } = Select;

function LoopPart() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const partCount = state?.part || 0;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentRangeInput, setCurrentRangeInput] = useState(0);

  const [partsData, setPartsData] = useState(
    Array.from({ length: partCount }, () => ({
      case: "",
      rangeInput: "",
      typePoint: "",
      option: "",
    }))
  );
  const handleAddClick = (index) => {
    // คำนวณค่ารวมของ rangeInput ก่อนหน้าทั้งหมด
    const start = partsData.slice(0, index).reduce((sum, part) => sum + parseInt(part.rangeInput || 0, 10), 0);
  
    // อัปเดตค่าที่จะส่งไปยัง Customize modal
    setCurrentRangeInput({
      start,
      rangeInput: partsData[index].rangeInput || 0,
    });
  
    setIsModalVisible(true);
  };
  

  const handleModalClose = () => {
    setIsModalVisible(false);
  };

  const handleChange = (index, field, value) => {
    const updatedPartsData = [...partsData];
    updatedPartsData[index][field] = value;

    if (field === "case") {
      if (value === "2") {
        updatedPartsData[index].option = "number";
      } else if (value === "3") {
        updatedPartsData[index].option = "sentence";
      } else if (value === "4") {
        updatedPartsData[index].option = "character";
      } else {
        updatedPartsData[index].option = "";
      }
    }

    setPartsData(updatedPartsData);
  };

  const handleExit = () => {
    Modal.confirm({
      title: "ต้องการย้อนกลับไปกรอกข้อมูลใหม่หรือไม่ ?",
      icon: <ExclamationCircleFilled />,
      content: "เมื่อกดตกลงแล้ว จะย้อนกลับไปกรอกข้อมูลใหม่ตั้งแต่ต้น",
      width: 550,
      className: "custom-modal",
      okText: "ตกลง",
      cancelText: "ยกเลิก",
      onOk: async () => {
        try {
          await fetch("http://127.0.0.1:5000/reset", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });
          navigate("/ExamPart");
        } catch (error) {
          console.error("Error resetting data:", error);
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const caseArray = partsData.map((part) => part.case);
      const rangeInputArray = partsData.map((part) => part.rangeInput);
      const typePointArray = partsData.map((part) => part.typePoint);
      const optionArray = partsData.map((part) => part.option);

      await fetch("http://127.0.0.1:5000/submit_parts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          case_array: caseArray,
          range_input_array: rangeInputArray,
          type_point_array: typePointArray,
          option_array: optionArray,
        }),
      });

      navigate("/Generate");
    } catch (error) {
      console.error("Error submitting data:", error);
    }
  };

  return (
    <div>
      <h1 className="Title">สร้างกระดาษคำตอบ</h1>
      <Card
        title="สร้างกระดาษคำตอบที่นี่ ( รองรับรูปแบบกระดาษ A4 ในแนวตั้งเท่านั้น )"
        className="card-edit"
        style={{
          width: "100%",
          minHeight: 600,
          margin: "0 auto",
          height: "auto",
        }}
      >
        {Array.from({ length: partCount }, (_, i) => (
          <div key={i} style={{ marginBottom: "20px" }}>
            <div className="condition-container">
              <h2 className="topic">ตอนที่ {i + 1}</h2>

              <div className="condition-group">
                <div className="input-group">
                  <h3 className="label">รูปแบบข้อสอบ : </h3>
                  <Select
                    value={partsData[i].case || undefined}
                    onChange={(value) => handleChange(i, "case", value)}
                    className="custom-select"
                    placeholder="กรุณาเลือกรูปแบบข้อสอบ..."
                    style={{ width: 340, height: 40 }}
                  >
                    <Option value="1">1 digit</Option>
                    <Option value="2">2 digit</Option>
                    <Option value="3">Long box</Option>
                    <Option value="4">True or False</Option>
                    <Option value="5">Cross option</Option>
                  </Select>
                </div>

                <div className="input-group">
                  <h3 className="label">จำนวนข้อ : </h3>
                  <input
                    type="number"
                    value={partsData[i].rangeInput}
                    min="0"
                    onChange={(e) =>
                      handleChange(i, "rangeInput", e.target.value)
                    }
                    className="input-box"
                  />
                </div>
              </div>

              <div className="condition-group">
                <div className="input-group">
                  <h3 className="label">รูปแบบคะแนน : </h3>
                  <Select
                    value={partsData[i].typePoint || undefined}
                    onChange={(value) => handleChange(i, "typePoint", value)}
                    className="custom-select"
                    placeholder="กรุณาเลือกรูปแบบคะแนน..."
                    style={{ width: 340, height: 40 }}
                  >
                    <Option value="Single">Single Point</Option>
                    {/*<Option value="Group">Group Point</Option>*/}
                    <Option value="Customize">Customize</Option>
                  </Select>
                  {partsData[i].typePoint === "Customize" && (
                    <div style={{ marginLeft: "20px" }}>
                      <Button
                        variant="primary"
                        size="edit"
                        onClick={() => handleAddClick(i)} // ส่ง index ของ part ปัจจุบัน
                      >
                        <EditIcon />
                      </Button>

                    </div>
                  )}
                </div>

                {partsData[i].case === "1" && (
                  <>
                    <div className="input-group">
                      <h3 className="label">ประเภท : </h3>
                      <Select
                        value={partsData[i].option}
                        onChange={(value) => handleChange(i, "option", value)}
                        className="custom-select"
                        placeholder="กรุณาเลือกประเภท..."
                        style={{ width: 340, height: 40 }}
                      >
                        <Option value="number">ตัวเลข</Option>
                        <Option value="character">ตัวอักษร</Option>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        <div className="Buttoncase2-container">
          <Button variant="light" size="md" onClick={handleExit}>
            ย้อนกลับ
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit}>
            สร้าง
          </Button>
        </div>
      </Card>
      <Customize
        visible={isModalVisible}
        onClose={handleModalClose}
        start={currentRangeInput.start} // ส่งค่า start
        rangeInput={currentRangeInput.rangeInput} // ส่งค่า rangeInput
      />

    </div>
  );
}

export default LoopPart;
