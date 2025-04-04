import React, { useEffect, useState, message } from "react";
import axios from "axios";
import { Button } from "antd";

const A4_WIDTH = 500;
const A4_HEIGHT = (A4_WIDTH / 793.7) * 1122.5; // คำนวณความสูงสัมพันธ์กับความกว้าง

const OverlayBoxes = ({
  subjectId,
  pageNo,
  answerDetails,
  fetchExamSheets,
  handleCalScorePage,
  examSheet,
  setExamSheet,
}) => {
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    //console.log("Current examSheet:", examSheet);
    if (subjectId && pageNo) {
      // ดึง JSON สำหรับตำแหน่ง
      fetch(
        `http://127.0.0.1:5000/get_position?subjectId=${subjectId}&pageNo=${pageNo}`
      )
        .then((response) => response.json())
        .then((data) => {
          //console.log("Positions JSON:", data);
          setPositions(data);
          //console.log("Current positions:", positions);
        })
        .catch((error) => console.error("Error fetching positions:", error));
    }
  }, [subjectId, pageNo, examSheet]);

  const handleCheck = async (modelread, displayLabel, ansId, Type_score) => {
    // ตั้งค่า newAns และ scoreToUpdate ตามเงื่อนไข
    const newAns =
      modelread.toLowerCase() === displayLabel.toLowerCase()
        ? "-"
        : displayLabel;
    const scoreToUpdate =
      modelread.toLowerCase() === displayLabel.toLowerCase()
        ? 0
        : parseFloat(Type_score) || 0;

    try {
      console.log(
        `AnsId: ${ansId}, scoreToUpdate: ${scoreToUpdate}, modelread: ${newAns}`
      );

      // เรียกใช้ /update_scorepoint
      const updateScoreResponse = await axios.put(
        `http://127.0.0.1:5000/update_scorepoint/${ansId}`,
        {
          score_point: scoreToUpdate, // ส่งคะแนนที่คำนวณ
        }
      );

      if (updateScoreResponse.status === 200) {
        console.log(
          "Score point updated successfully:",
          updateScoreResponse.data.message
        );

        // จากนั้นอัปเดต modelread
        const response = await axios.put(
          `http://127.0.0.1:5000/update_modelread/${ansId}`,
          {
            modelread: newAns,
          }
        );

        if (response.status === 200) {
          console.log("Modelread updated successfully:", response.data.message);

          // เรียกใช้ /cal_scorepage หลังอัปเดตสำเร็จ
          await handleCalScorePage(ansId);

          // เรียกฟังก์ชัน fetchExamSheets เพื่อดึงข้อมูลใหม่
          await fetchExamSheets(pageNo);
        } else {
          console.error("Error updating modelread:", response.data.message);
        }
      } else {
        console.error(
          "Error updating score point:",
          updateScoreResponse.data.message
        );
      }
    } catch (error) {
      console.error("Error during update:", error);
    }
  };

  const updateStudentId = async (sheetId, newId) => {
    try {
      const response = await fetch("http://127.0.0.1:5000/edit_predictID", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet_id: sheetId, new_id: newId }),
      });

      const result = await response.json();
      if (result.success) {
        console.log("Updated successfully!");

        await handleCalEnroll();
      } else {
        console.error("Update failed:", result.error);
      }
    } catch (error) {
      console.error("Error updating ID:", error);
    }
  };

  const handleCalEnroll = async () => {
    try {
      if (!examSheet?.Sheet_id || !subjectId) {
        console.error("Missing required parameters: Sheet_id or Subject_id");
        return;
      }

      const response = await axios.post("http://127.0.0.1:5000/cal_enroll", {
        Sheet_id: examSheet.Sheet_id,
        Subject_id: subjectId,
      });

      if (response?.data?.status === "success") {
        console.log("Score calculation successful: ", response.data);

        if (typeof fetchExamSheets === "function" && pageNo !== undefined) {
          await fetchExamSheets(pageNo);
        } else {
          console.error("fetchExamSheets is not defined or pageNo is missing");
        }
      } else {
        message.error(response?.data?.message || "Score calculation failed");
      }
    } catch (error) {
      console.error("Error calculating score:", error);
    }
  };

  // ฟังก์ชันสำหรับสร้าง div ที่แสดงค่า Id_predict
  const IdDiv = () => {
    if (!examSheet?.Id_predict) return null;

    // กำหนดตำแหน่งของแต่ละตัวอักษร
    const allPositions = [
      [480, 410, 580, 530],
      [610, 410, 710, 530],
      [740, 410, 840, 530],
      [870, 410, 970, 530],
      [1000, 410, 1100, 530],
      [1130, 410, 1230, 530],
      [1260, 410, 1360, 530],
      [1390, 410, 1490, 530],
      [1520, 410, 1620, 530],
      [1650, 410, 1750, 530],
      [1780, 410, 1880, 530],
      [1910, 410, 2010, 530],
    ];

    // คำนวณตำแหน่งของ input box
    const minX = Math.min(...allPositions.map((pos) => pos[0]));
    const minY = Math.min(...allPositions.map((pos) => pos[1]));
    const maxX = Math.max(...allPositions.map((pos) => pos[2]));
    const maxY = Math.max(...allPositions.map((pos) => pos[3]));

    // บังคับให้ input box มี 13 ช่องเสมอ
    let idPredict = examSheet.Id_predict.padEnd(13, " ").slice(0, 13);

    const handleInputChange = (index, value) => {
      if (!examSheet) return;
      let newId = idPredict.split("");

      if (value === "") {
        newId[index] = " "; // กรณีลบ ให้ใช้ช่องว่างแทน
      } else {
        newId[index] = value.slice(-1); // รับเฉพาะตัวสุดท้าย
      }

      setExamSheet({ ...examSheet, Id_predict: newId.join("") });
    };

    const handleBlur = () => {
      if (examSheet) {
        updateStudentId(examSheet.Sheet_id, examSheet.Id_predict.trim());
      }
    };

    return (
      <div
        key="id-predict"
        style={{
          position: "absolute",
          left: (minX / 2480) * A4_WIDTH - 5,
          top: (minY / 3508) * A4_HEIGHT - 25,
          width: ((maxX - minX) / 2480) * A4_WIDTH * 0.6,
          height: ((maxY - minY) / 3508) * A4_HEIGHT * 0.2,
          display: "flex",
          gap: "6px",
          padding: "5px",
          zIndex: 1000,
        }}
      >
        {idPredict.split("").map((char, index) => (
          <input
            key={`char-${index}`}
            className={`student-id-overlay ${
              examSheet?.same_id === 1 ? "correct" : "incorrect"
            }`}
            type="text"
            value={char === " " ? "" : char} // แสดงค่าว่างถ้าเป็น " "
            onChange={(e) => handleInputChange(index, e.target.value)}
            onBlur={handleBlur}
            onFocus={(e) => e.target.select()} // ให้เลือกข้อความทั้งหมดเมื่อคลิก
            maxLength={1}
          />
        ))}
      </div>
    );
  };

  const renderDivs = (position, key, label) => {
    // เพิ่ม div สำหรับแสดงคะแนน
    const scoreDiv = (
      <div
        style={{
          position: "absolute",
          top: "15px", // ระยะห่างจากขอบบน
          right: "15px", // ระยะห่างจากขอบขวา
          backgroundColor: "#f4f4f4", // สีพื้นหลัง
          padding: "5px 10px",
          borderRadius: "5px",
          fontSize: "14px",
          zIndex: 1000,
        }}
      >
        {examSheet?.score !== null && examSheet?.score !== undefined
          ? `Score: ${examSheet.score}`
          : "ยังไม่มีข้อมูล"}
      </div>
    );

    // เพิ่มเงื่อนไขแสดง `IdDiv` และ `scoreDiv` เสมอ
    const additionalDivs = (
      <>
        {scoreDiv}
        {IdDiv()}
      </>
    );

    //console.log("examSheet.score", examSheet?.score);
    if (!position || label === "id") return additionalDivs;

    // แปลง `key` เป็น number เพื่อการเปรียบเทียบ
    const parsedKey = parseInt(key);
    const answerDetail = answerDetails.find((item) => item.no === parsedKey);

    if (!answerDetail) return null;

    const displayLabel = answerDetail.label || ""; // ดึงค่า label จาก answerDetails (กรณี null ให้เป็น "")
    const modelread = answerDetail.Predict || ""; // ดึงค่า Predict จาก answerDetails (กรณี null ให้เป็น "")

    // แปลงเป็นพิมพ์เล็กทั้งหมดก่อนเปรียบเทียบ
    const isCorrect = modelread.toLowerCase() === displayLabel.toLowerCase();
    const isCleared = modelread.trim() === ""; // ✅ ตรวจว่าถูกเคลียร์แล้ว

    const buttonStatusClass =
      answerDetail.free === 1
        ? "free"
        : isCleared
        ? "cleared"
        : isCorrect
        ? "correct"
        : "incorrect";

    // หากเป็น Array ของโพซิชัน (หลายตำแหน่ง)
    if (Array.isArray(position[0])) {
      // รวมโพซิชันทั้งหมดเข้าด้วยกัน (หา min/max)
      const minX = Math.min(...position.map((pos) => pos[0])); // ด้านซ้ายสุด
      const minY = Math.min(...position.map((pos) => pos[1])); // ด้านบนสุด
      const maxX = Math.max(...position.map((pos) => pos[2])); // ด้านขวาสุด
      const maxY = Math.max(...position.map((pos) => pos[3])); // ด้านล่างสุด

      return (
        //2 digit
        <>
          {additionalDivs}
          <div>
            <div
              key={key}
              className="label-boxes-button-style"
              style={{
                left: (minX / 2480) * A4_WIDTH,
                top: (minY / 3508) * A4_HEIGHT - 38,
                width: ((maxX - minX) / 2480) * A4_WIDTH * 1.0,
                height: ((maxY - minY) / 3508) * A4_HEIGHT * 0.72,
              }}
              type="text"
            >
              {displayLabel}
            </div>
            <Button
              className={`predict-boxes-button-style ${buttonStatusClass}`}
              style={{
                left: (minX / 2480) * A4_WIDTH,
                top: (minY / 3508) * A4_HEIGHT - 20,
                width: ((maxX - minX) / 2480) * A4_WIDTH * 1.0,
                height: ((maxY - minY) / 3508) * A4_HEIGHT * 0.72,
              }}
              type="text"
              onClick={() =>
                handleCheck(
                  modelread,
                  displayLabel,
                  answerDetail.Ans_id,
                  answerDetail.Type_score
                )
              }
            >
              <span className="predict-text">{modelread}</span>
            </Button>
          </div>
        </>
      );
    } else {
      const isSentence = displayLabel.split(" ").length > 1;
      return (
        //1 digit
        <>
          {additionalDivs}
          <div>
            <div
              className="label-boxes-button-style"
              key={key}
              style={{
                left: (position[0] / 2487) * A4_WIDTH,
                top: (position[1] / 3508) * A4_HEIGHT - 32,
                width: ((position[2] - position[0]) / 2480) * A4_WIDTH,
                height: ((position[3] - position[1]) / 3508) * A4_HEIGHT * 0.65,
                justifyContent: isSentence ? "flex-start" : "center",
                padding: isSentence ? "0 10px" : "0",
              }}
              type="text"
            >
              {displayLabel}
            </div>
            <Button
              className={`predict-boxes-button-style ${buttonStatusClass}`}
              style={{
                left: (position[0] / 2487) * A4_WIDTH,
                top: (position[1] / 3508) * A4_HEIGHT - 16,
                width: ((position[2] - position[0]) / 2480) * A4_WIDTH, // ลดขนาดลง 80% ของเดิม
                height: ((position[3] - position[1]) / 3508) * A4_HEIGHT * 0.65,

                justifyContent: isSentence ? "flex-start" : "center",
                padding: isSentence ? "0 10px" : "0",
              }}
              type="text"
              onClick={() =>
                handleCheck(
                  modelread,
                  displayLabel,
                  answerDetail.Ans_id,
                  answerDetail.Type_score
                )
              }
            >
              <span className="predict-text">{modelread}</span>
            </Button>
          </div>
        </>
      );
    }
  };

  return (
    <>
      {Object.entries(positions).map(([key, value]) => (
        <React.Fragment key={key}>
          {renderDivs(value.position, key, value.label)}
        </React.Fragment>
      ))}
    </>
  );
};

export default OverlayBoxes;
