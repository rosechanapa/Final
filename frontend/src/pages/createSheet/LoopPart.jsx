import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, Select, Modal, Tooltip, Input, message } from "antd";
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
  const subjectId = state?.subjectId;
  const [modalPoint, setModalPoint] = useState({});
  const [Pointarray1, setPointarray1] = useState([]);
  const [Pointarray2, setPointarray2] = useState([]);
  const [currentPartIndex, setCurrentPartIndex] = useState(null);

  const [partsData, setPartsData] = useState(
    Array.from({ length: partCount }, () => ({
      case: "",
      rangeInput: "",
      typePoint: "",
      option: "",
      lines_dict_array: {},
      choiceType: "",
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
    setCurrentPartIndex(index);
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
        updatedData[index].point_input = 0;
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
          const response = await fetch(
            `http://127.0.0.1:5000/reset_back/${subjectId}`,
            {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
          if (!response.ok) {
            throw new Error(`Failed to reset: ${response.statusText}`);
          }

          navigate("/ExamPart");
        } catch (error) {
          console.error("Error resetting data:", error);
        }
      },
    });
  };

  const isFormValid = () => {
    // ตรวจสอบว่าทุกส่วนที่จำเป็นถูกกรอก
    const arePartsValid = partsData.every((part) => {
      if (!part.case || !part.rangeInput || !part.typePoint) {
        return false; // ตรวจสอบฟิลด์หลัก
      }
      if (part.case === "1" && !part.option) {
        return false; // ตรวจสอบ option หาก case === "1"
      }
      if (part.case === "5" && !part.choiceType) {
        return false; // ตรวจสอบ choiceType หาก case === "5"
      }

      if (
        part.typePoint === "Single" &&
        (!part.point_input || part.point_input <= 0)
      ) {
        return false;
      }
      return true;
    });

    // const isCustomizeValid =
    //   Object.values(modalPoint).some((item) => item.point > 0) ||
    //   Pointarray1.some((point) => point > 0) ||
    //   Pointarray2.some((point) => point > 0);

    // const hasCustomizeType = partsData.some(
    //   (part) => part.typePoint === "Customize"
    // );
    return arePartsValid;
    // return arePartsValid && (!hasCustomizeType || isCustomizeValid);
  };

  const handleSubmit = async () => {
    const hasCustomizeType = partsData.some(
      (part) => part.typePoint === "Customize"
    );

    const modalPointValid =
      Object.values(modalPoint).length > 0 && // ต้องมีข้อมูล
      Object.values(modalPoint).every((item) => parseFloat(item.point) > 0);

    // const pointArray1Valid =
    //   Pointarray1.length > 0 &&
    //   Pointarray1.every((point) => point !== undefined && point > 0);

    // const pointArray2Valid =
    //   Pointarray2.length > 0 &&
    //   Pointarray2.every((point) => point !== undefined && point > 0);
    const allPointArray1Valid = Pointarray1.every(
      (array) =>
        array?.every((point) => point !== undefined && parseFloat(point) > 0) ??
        true
    );

    const allPointArray2Valid = Pointarray2.every(
      (array) =>
        array?.every((point) => point !== undefined && parseFloat(point) > 0) ??
        true
    );

    const isCustomizeValid =
      modalPointValid && allPointArray1Valid && allPointArray2Valid;

    if (hasCustomizeType && !isCustomizeValid) {
      console.log("ยังไม่ได้ใส่คะแนนใน Customize");
      message.error(
        "กรุณาใส่คะแนนที่ Customize ให้เรียบร้อย ก่อนกดปุ่มสร้าง",
        3
      );
      return;
    }

    try {
      const caseArray = partsData.map((part) => part.case);
      const rangeInputArray = partsData.map((part) => part.rangeInput);
      const optionArray = partsData.map((part) => part.option);
      const choiceTypeArray = partsData.map((part) => part.choiceType);

      // สร้าง typePointArray
      const typePointArray = partsData.reduce((acc, part, index) => {
        if (part.typePoint === "Customize") {
          return acc; // ข้ามเมื่อ typePoint เป็น 'Customize'
        }
        console.log("Type Point Array:", typePointArray);

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
            case: part.case,
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
          choice_type_array: choiceTypeArray,
        }),
      });

      // navigate("/Generate");
      navigate("/Generate", { state: { subjectId } });
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
    const parsedValue = value === "" ? "" : parseFloat(value);
    setPartsData((prevData) => {
      const updatedData = [...prevData];
      updatedData[index].point_input = value;
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
                    placeholder="จำนวนข้อ..."
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
                    <Tooltip
                      title="สำหรับจัดการรูปแบบคะแนน"
                      overlayInnerStyle={{ color: "#3b3b3b", fontSize: "14px" }}
                    >
                      <div style={{ marginLeft: "20px" }}>
                        <Button
                          variant="primary"
                          size="edit"
                          onClick={() => handleAddClick(i)}
                        >
                          <EditIcon />
                        </Button>
                      </div>
                    </Tooltip>
                  )}
                </div>

                {partsData[i].typePoint === "Single" && (
                  <div className="input-group">
                    <h3 className="label">คะแนนแต่ละข้อ:</h3>
                    <input
                      type="number"
                      placeholder="กรุณาใส่คะแนน"
                      value={partsData[i].point_input || ""}
                      onChange={(e) => {
                        const inputValue = e.target.value;

                        // ตรวจสอบว่าเป็นตัวเลขหรือทศนิยม
                        if (/^(\d+|\d*\.\d*)?$/.test(inputValue)) {
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
                          value={partsData[i].option || undefined}
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
                {partsData[i].case === "5" &&
                  partsData[i].typePoint === "Customize" && (
                    <div className="input-group">
                      <h3 className="label">ประเภท Choice:</h3>
                      <Select
                        value={partsData[i].choiceType || undefined}
                        onChange={(value) =>
                          handleChange(i, "choiceType", value)
                        }
                        className="custom-select"
                        placeholder="กรุณาเลือกประเภท Choice..."
                        style={{ width: 340, height: 40 }}
                      >
                        <Option value={4}>4 Choice</Option>
                        <Option value={5}>5 Choice</Option>
                      </Select>
                    </div>
                  )}
              </div>

              <div className="condition-group">
                {partsData[i].case === "1" &&
                  partsData[i].typePoint === "Single" && (
                    <>
                      <div className="input-group">
                        <h3 className="label">ประเภท : </h3>
                        <Select
                          value={partsData[i].option || undefined}
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
                {partsData[i].case === "5" &&
                  partsData[i].typePoint === "Single" && (
                    <div className="input-group">
                      <h3 className="label">ประเภท Choice:</h3>
                      <Select
                        value={partsData[i].choiceType || undefined}
                        onChange={(value) =>
                          handleChange(i, "choiceType", value)
                        }
                        className="custom-select"
                        placeholder="กรุณาเลือกประเภท Choice..."
                        style={{ width: 340, height: 40 }}
                      >
                        <Option value={4}>4 Choice</Option>
                        <Option value={5}>5 Choice</Option>
                      </Select>
                    </div>
                  )}
              </div>

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
        ))}
        <div className="Buttoncase2-container">
          <Button variant="light" size="md" onClick={handleExit}>
            ย้อนกลับ
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={!isFormValid()}
          >
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
        partIndex={currentPartIndex}
        setModalPoint={setModalPoint}
        caseArray={partsData.map((part) => part.case)}
        setPointarray1={(updatedArray) => {
          setPointarray1(updatedArray); // ตรวจสอบว่า setPointarray1 อัปเดตค่าถูกต้อง
        }}
        setPointarray2={(updatedArray) => {
          setPointarray2(updatedArray); // ตรวจสอบว่า setPointarray2 อัปเดตค่าถูกต้อง
        }}
      />
    </div>
  );
}

export default LoopPart;
