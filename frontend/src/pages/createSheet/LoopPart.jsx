import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, Select, Modal, Tooltip, Input } from "antd";
import Button from "../../components/Button";
import { ExclamationCircleFilled } from "@ant-design/icons";
import EditIcon from "@mui/icons-material/Edit";
import Customize from "../createSheet/Modal/Customize";
import "../../css/createExamsheet.css";

const { Option } = Select;

function LoopPart() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const partCount = state?.part || 0;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentRangeInput, setCurrentRangeInput] = useState(0);

  const [modalPoint, setModalPoint] = useState({});

  const [partsData, setPartsData] = useState(
    Array.from({ length: partCount }, () => ({
      case: "",
      rangeInput: "",
      typePoint: "",
      option: "",
      lines_dict_array: {},
    }))
  );

  const handleAddClick = (index) => {
    const start = partsData
      .slice(0, index)
      .reduce((sum, part) => sum + parseInt(part.rangeInput || 0, 10), 0);
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
    setPartsData((prevData) => {
      const updatedData = [...prevData];
      updatedData[index] = {
        ...updatedData[index],
        [field]: value,
      };

      // อัปเดตค่า option ตามค่า case
      if (field === "case") {
        const caseOptions = {
          2: "number",
          3: "sentence",
          4: "character",
          5: "choice",
          6: "line",
        };
        updatedData[index].option = caseOptions[value] || "";
      }

      if (field === "typePoint" && value === "Single") {
        updatedData[index].point_input = 0; // ค่าเริ่มต้นสำหรับคะแนน
      }

      return updatedData;
    });
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
          await fetch("http://127.0.0.1:5000/reset_back", {
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
      const optionArray = partsData.map((part) => part.option);

      // สร้าง typePointArray
      const typePointArray = partsData.reduce((acc, part, index) => {
        if (part.typePoint === "Customize") {
          return acc; // ข้ามเมื่อ typePoint เป็น 'Customize'
        }

        const start = partsData
          .slice(0, index)
          .reduce((sum, p) => sum + parseInt(p.rangeInput || 0, 10), 0);
        const rangeInput = parseInt(part.rangeInput || 0, 10);

        for (let n = 0; n < rangeInput; n++) {
          const key = start + n + 1;
          acc[key] = {
            type: part.typePoint,
            order: null,
            point: part.point_input || 0,
          };
        }

        return acc;
      }, {});

      console.log("Initial Type Point Array:", typePointArray);

      // รวมข้อมูล modalPoint กับ typePointArray
      Object.keys(modalPoint).forEach((key) => {
        typePointArray[key] = modalPoint[key];
      });

      console.log(
        "Updated Type Point Array after adding modalPoint:",
        typePointArray
      );

      const linesDictArray = partsData.reduce((acc, part, index) => {
        const { lines_dict_array = {} } = part;
        Object.keys(lines_dict_array).forEach((key) => {
          acc[key] = lines_dict_array[key];
        });
        return acc;
      }, {});

      // ส่งข้อมูลไปยัง API
      await fetch("http://127.0.0.1:5000/submit_parts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          case_array: caseArray,
          range_input_array: rangeInputArray,
          option_array: optionArray,
          lines_dict_array: linesDictArray,
          type_point_array: [typePointArray],
        }),
      });

      navigate("/Generate");
    } catch (error) {
      console.error("Error submitting data:", error);
    }
  };

  const renderLineInputModal = (index) => {
    const start = partsData
      .slice(0, index)
      .reduce((sum, part) => sum + parseInt(part.rangeInput || 0, 10), 0);
    const rangeInput = parseInt(partsData[index].rangeInput || 0, 10);

    if (rangeInput > 0) {
      return (
        <div>
          <Card
            title={`กรุณาเพิ่มจำนวนบรรทัดสำหรับแต่ละข้อ (ตอนที่ ${index + 1})`}
            className="card-edit"
            style={{
              width: "80%",
              margin: "0 auto",
              padding: "10px",
              minHeight: "200px",
              maxHeight: "400px",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                justifyContent: "space-between",
              }}
            >
              {Array.from({ length: rangeInput }, (_, n) => (
                <div
                  key={n}
                  style={{
                    width: "48%",
                    marginBottom: "8px",
                  }}
                >
                  <label className="label-mini">ข้อที่ {start + n + 1}:</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="5"
                    onChange={(e) => {
                      const numLines = parseInt(e.target.value, 10) || 5; // ค่าเริ่มต้นเป็น 5 หากไม่มีการกรอก
                      setPartsData((prevData) => {
                        const updatedData = [...prevData];
                        updatedData[index].lines_dict_array = {
                          ...(updatedData[index].lines_dict_array || {}),
                          [start + n]: numLines,
                        };
                        return updatedData;
                      });
                    }}
                    style={{
                      width: "100%",
                      padding: "5px 15px",
                      color: "#263238",
                      textAlign: "left",
                    }}
                    className="input-box"
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>
      );
    }
  };
  const handlePointChange = (index, value) => {
    setPartsData((prevData) => {
      const updatedData = [...prevData];
      const parsedValue = parseFloat(value) || 0; // แปลงค่าเป็นตัวเลขหรือใช้ค่าเริ่มต้นเป็น 0
      updatedData[index].point_input = parseFloat(parsedValue.toFixed(1)); // ฟอร์แมตค่าทศนิยม 1 ตำแหน่ง
      return updatedData;
    });
  };

  // const handleKeyDown = (event) => {
  //   if (event.key === "Enter") {
  //     handleSubmit(event); // เรียก handleSubmit เมื่อกด Enter
  //   }
  // };

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
                    <Option value="6">line</Option>
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
                    {/* <Option value="Group">Group Point</Option> */}
                    <Option value="Customize">Customize</Option>
                  </Select>
                  {partsData[i].typePoint === "Customize" && (
                    <div style={{ marginLeft: "20px" }}>
                      <Button
                        variant="primary"
                        size="edit"
                        onClick={() => handleAddClick(i)}
                      >
                        <EditIcon />
                      </Button>
                    </div>
                  )}
                </div>

                {partsData[i].typePoint === "Single" && (
                  <div className="input-group">
                    <h3 className="label">คะแนนแต่ละข้อ:</h3>
                    <input
                      type="text"
                      placeholder="กรุณาใส่คะแนน"
                      value={partsData[i].point_input || ""}
                      onChange={(e) => {
                        const inputValue = e.target.value;

                        // ตรวจสอบรูปแบบตัวเลขและอนุญาตให้มี 0 นำหน้า
                        if (/^0*(\d+(\.\d*)?)?$/.test(inputValue)) {
                          handlePointChange(i, inputValue);
                        }
                      }}
                      className="input-box"
                    />
                  </div>
                )}
                {partsData[i].case === "1" &&
                  partsData[i].typePoint === "Customize" && (
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

              <div className="condition-group">
                {partsData[i].case === "1" &&
                  partsData[i].typePoint === "Single" && (
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

                {partsData[i].case === "6" && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    {renderLineInputModal(i)}
                  </div>
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
        start={currentRangeInput.start}
        rangeInput={currentRangeInput.rangeInput}
        typePointArray={partsData.map((part) => part.typePoint)}
        rangeInputArray={partsData.map((part) => part.rangeInput)}
        setModalPoint={setModalPoint}
        caseArray={partsData.map((part) => part.case)}
      />
    </div>
  );
}

export default LoopPart;
