import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, Select, Modal, Tooltip, Spin } from "antd";
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
  const [loading, setLoading] = useState(false);
  const [partsData, setPartsData] = useState(
    Array.from({ length: partCount }, () => ({
      case: "",
      option_case: "",
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

      if (field === "case" || field === "option" || field === "choiceType") {
        const part = updatedData[index];

        if (part.case === "1") {
          if (part.option === "number") {
            part.option_case = "11";
          } else if (part.option === "character") {
            part.option_case = "12";
          }
        } else if (part.case === "5") {
          if (part.choiceType === "4") {
            part.option_case = "51";
          } else if (part.choiceType === "5") {
            part.option_case = "52";
          }
        } else if (["2", "3", "4", "6"].includes(part.case)) {
          part.option_case = part.case; // เก็บค่าตรงกับ case โดยตรง
        } else {
          part.option_case = ""; // รีเซ็ตหากไม่ตรงเงื่อนไข
        }
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
      width: 500,

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
    // ตรวจสอบเงื่อนไขใน partsData
    const isPartsDataValid = partsData.every((part) => {
      if (!part.case || !part.rangeInput || !part.typePoint) {
        return false; // ฟิลด์หลักต้องไม่ว่างเปล่า
      }
      if (part.case === "1" && !part.option) {
        return false; // กรณี case === "1" ต้องมี option
      }
      if (part.case === "5" && !part.choiceType) {
        return false; // กรณี case === "5" ต้องมี choiceType
      }
      if (
        part.case === "6" &&
        Object.keys(part.lines_dict_array || {}).length === 0
      ) {
        return false; // กรณี case === "6" ต้องมีค่าใน lines_dict_array
      }
      return true; // ผ่านการตรวจสอบสำหรับ part นี้
    });

    // ตรวจสอบ caseArray และ rangeInputArray
    const caseArray = partsData.map((part) => part.case);
    const rangeInputArray = partsData.map((part) => part.rangeInput);
    const isArrayValid =
      !caseArray.includes("") && !rangeInputArray.includes("");

    // ตรวจสอบ modalPointData
    const isModalPointValid = Object.values(modalPoint).every((data) => {
      // ยอมรับ case เป็น null และ point เป็น 0
      if (data.case === null && data.point === 0) {
        return true;
      }
      return data.point !== 0 && data.case !== "";
    });

    // ตรวจสอบ typePoint
    const isTypePointValid = partsData.every((part) => {
      return part.typePoint !== "" && part.point !== 0;
    });

    // ผลรวมของเงื่อนไขทั้งหมด
    return (
      isPartsDataValid && isArrayValid && isModalPointValid && isTypePointValid
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
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
            case: part.option_case,
          };
        }

        return acc;
      }, {});

      //console.log("Initial Type Point Array:", typePointArray);

      // รวมข้อมูล modalPoint กับ typePointArray
      Object.keys(modalPoint).forEach((key) => {
        // ข้ามกรณีที่ case มีค่า null
        if (modalPoint[key].case === null) {
          return; // ข้ามไป key ถัดไป
        }

        // อัปเดต typePointArray ด้วยค่า modalPoint
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

      //console.log("Updated lines_dict_array for Index:", linesDictArray);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // ค้นหาเฉพาะ index ที่มี case === "6"
    const updatedPartsData = partsData.map((part, idx) => {
      if (part.case === "6") {
        //console.log(`Index: ${idx}, RangeInput: ${part.rangeInput}`);
        const rangeInput = parseInt(part.rangeInput || 0, 10);

        // คำนวณค่า start โดยรวม rangeInput ของ parts ก่อนหน้า
        const start = partsData
          .slice(0, idx)
          .reduce(
            (sum, prevPart) => sum + parseInt(prevPart.rangeInput || 0, 10),
            0
          );

        // ตรวจสอบและเพิ่มค่าใหม่ใน lines_dict_array โดยไม่เขียนทับค่าเดิม
        if (rangeInput > 0) {
          const half = Math.ceil(rangeInput / 2);
          const newLinesDictArray = { ...part.lines_dict_array }; // เริ่มจากค่าเดิม

          // เติมค่าฝั่งซ้าย
          for (let n = 0; n < half; n++) {
            const key = start + n;
            if (!(key in newLinesDictArray)) {
              newLinesDictArray[key] = 5; // เพิ่มเฉพาะถ้ายังไม่มีค่าใน key นี้
            }
          }

          // เติมค่าฝั่งขวา
          for (let n = 0; n < rangeInput - half; n++) {
            const key = start + half + n;
            if (!(key in newLinesDictArray)) {
              newLinesDictArray[key] = 5; // เพิ่มเฉพาะถ้ายังไม่มีค่าใน key นี้
            }
          }

          //console.log(`Updated lines_dict_array for Index: ${idx}`, newLinesDictArray);

          return {
            ...part,
            lines_dict_array: newLinesDictArray,
          };
        }
      }
      return part;
    });

    // อัปเดต partsData เฉพาะเมื่อมีการเปลี่ยนแปลงจริง
    if (JSON.stringify(updatedPartsData) !== JSON.stringify(partsData)) {
      setPartsData(updatedPartsData);
    }
  }, [partsData]);

  const renderLineInputModal = (index) => {
    const start = partsData
      .slice(0, index)
      .reduce((sum, part) => sum + parseInt(part.rangeInput || 0, 10), 0);
    const rangeInput = parseInt(partsData[index].rangeInput || 0, 10);

    if (rangeInput > 0) {
      // คำนวณจำนวนข้อในแต่ละฝั่ง
      const half = Math.ceil(rangeInput / 2);

      return (
        <div>
          <Card
            title={
              <span className="font-head-line">
                กรุณาเพิ่มจำนวนบรรทัดสำหรับแต่ละข้อ (ตอนที่ {index + 1})
              </span>
            }
            className="card-edit"
            style={{
              width: "100%",
              marginTop: "-100px",
              padding: "10px",
              minHeight: "200px",
              maxHeight: "400px",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              {/* ฝั่งซ้าย */}
              <div style={{ width: "48%" }}>
                {Array.from({ length: half }, (_, n) => (
                  <div key={`left-${n}`} style={{ marginBottom: "12px" }}>
                    <label className="label-mini">
                      ข้อที่ {start + n + 1}:
                    </label>
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
                      className="input-box-line"
                    />
                  </div>
                ))}
              </div>

              {/* ฝั่งขวา */}
              <div style={{ width: "48%" }}>
                {Array.from({ length: rangeInput - half }, (_, n) => (
                  <div key={`right-${n}`} style={{ marginBottom: "12px" }}>
                    <label className="label-mini">
                      ข้อที่ {start + half + n + 1}:
                    </label>
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
                            [start + half + n]: numLines,
                          };
                          return updatedData;
                        });
                      }}
                      className="input-box-line"
                    />
                  </div>
                ))}
              </div>
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

  return (
    <div>
      <h1 className="Title">สร้างกระดาษคำตอบ</h1>
      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
        <Card
          title={
            <span className="expart-title">
              สร้างกระดาษคำตอบที่นี่ ( รองรับรูปแบบกระดาษ A4 ในแนวตั้งเท่านั้น )
            </span>
          }
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
                    <h3 className="label-create">รูปแบบข้อสอบ : </h3>
                    <Select
                      value={partsData[i].case || undefined}
                      onChange={(value) => handleChange(i, "case", value)}
                      className="custom-select responsive-loop"
                      placeholder="กรุณาเลือกรูปแบบข้อสอบ..."
                      // style={{ width: 260, height: 35 }}
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
                    <h3 className="label-create">จำนวนข้อ : </h3>
                    <input
                      type="number"
                      value={partsData[i].rangeInput}
                      min="0"
                      placeholder="จำนวนข้อ..."
                      onChange={(e) =>
                        handleChange(i, "rangeInput", e.target.value)
                      }
                      className="input-box responsive-loop "
                      // style={{ width: "260px", height: "35px" }}
                    />
                  </div>
                </div>

                <div className="condition-group">
                  <div className="input-group">
                    <h3 className="label-create">รูปแบบคะแนน : </h3>
                    <Select
                      value={partsData[i].typePoint || undefined}
                      onChange={(value) => handleChange(i, "typePoint", value)}
                      className="custom-select responsive-loop"
                      placeholder="กรุณาเลือกรูปแบบคะแนน..."
                      // style={{ width: 260, height: 35 }}
                    >
                      <Option value="Single">Single Point</Option>
                      {/* <Option value="Group">Group Point</Option> */}
                      <Option value="Customize">Customize</Option>
                    </Select>
                    {partsData[i].typePoint === "Customize" && (
                      <Tooltip
                        title="สำหรับจัดการรูปแบบคะแนน"
                        overlayInnerStyle={{
                          color: "#3b3b3b",
                          fontSize: "14px",
                        }}
                      >
                        <div style={{ marginLeft: "10px" }}>
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
                      <h3 className="label-create">คะแนนแต่ละข้อ:</h3>
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
                        className="input-box responsive-loop"
                        // style={{ width: "260px", height: "35px" }}
                      />
                    </div>
                  )}
                  {partsData[i].case === "1" &&
                    partsData[i].typePoint === "Customize" && (
                      <>
                        <div className="input-group">
                          <h3 className="label-create">ประเภท : </h3>
                          <Select
                            value={partsData[i].option || undefined}
                            onChange={(value) =>
                              handleChange(i, "option", value)
                            }
                            className="custom-select responsive-loop"
                            placeholder="กรุณาเลือกประเภท..."
                            // style={{ width: 260, height: 35 }}
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
                        <h3 className="label-create">ประเภท Choice:</h3>
                        <Select
                          value={partsData[i].choiceType || undefined}
                          onChange={(value) =>
                            handleChange(i, "choiceType", value)
                          }
                          className="custom-select responsive-loop"
                          placeholder="กรุณาเลือกประเภท Choice..."
                          // style={{ width: 260, height: 35 }}
                        >
                          <Option value="4">4 Choice</Option>
                          <Option value="5">5 Choice</Option>
                        </Select>
                      </div>
                    )}
                </div>

                <div className="condition-group">
                  {partsData[i].case === "1" &&
                    partsData[i].typePoint === "Single" && (
                      <>
                        <div className="input-group">
                          <h3 className="label-create">ประเภท : </h3>
                          <Select
                            value={partsData[i].option || undefined}
                            onChange={(value) =>
                              handleChange(i, "option", value)
                            }
                            className="custom-select responsive-loop"
                            placeholder="กรุณาเลือกประเภท..."
                            // style={{ width: 260, height: 35 }}
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
                        <h3 className="label-create">ประเภท Choice:</h3>
                        <Select
                          value={partsData[i].choiceType || undefined}
                          onChange={(value) =>
                            handleChange(i, "choiceType", value)
                          }
                          className="custom-select responsive-loop"
                          placeholder="กรุณาเลือกประเภท Choice..."
                          // style={{ width: 260, height: 35 }}
                        >
                          <Option value="4">4 Choice</Option>
                          <Option value="5">5 Choice</Option>
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
              disabled={!isFormValid() || loading}
            >
              {loading ? <Spin /> : "สร้าง"}
            </Button>
          </div>
        </Card>
      )}
      <Customize
        visible={isModalVisible}
        onClose={handleModalClose}
        start={currentRangeInput.start}
        rangeInput={currentRangeInput.rangeInput}
        typePointArray={partsData.map((part) => part.typePoint)}
        rangeInputArray={partsData.map((part) => part.rangeInput)}
        setModalPoint={setModalPoint}
        caseArray={partsData.map((part) => part.option_case)}
      />
    </div>
  );
}

export default LoopPart;
