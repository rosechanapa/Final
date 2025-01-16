import React, { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "antd";

const A4_WIDTH = 700; // เพิ่มค่าความกว้างให้ใหญ่ขึ้น
const A4_HEIGHT = (A4_WIDTH / 793.7) * 1122.5; // คำนวณความสูงตามสัดส่วน

const OverlayBoxes = ({
  subjectId,
  pageNo,
  answerDetails,
  fetchExamSheets,
}) => {
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    if (subjectId && pageNo) {
      // ดึง JSON สำหรับตำแหน่ง
      fetch(
        `http://127.0.0.1:5000/get_position?subjectId=${subjectId}&pageNo=${pageNo}`
      )
        .then((response) => response.json())
        .then((data) => {
          console.log("Positions JSON:", data);
          setPositions(data);
        })
        .catch((error) => console.error("Error fetching positions:", error));
    }
  }, [subjectId, pageNo]);

  const handleCheck = async (modelread, displayLabel, ansId) => {
    let newAns = modelread === displayLabel ? "" : displayLabel;

    try {
      const response = await axios.put(
        `http://127.0.0.1:5000/update_modelread/${ansId}`,
        {
          modelread: newAns,
        }
      );

      if (response.status === 200) {
        console.log("Updated successfully:", response.data.message);
        // เรียกฟังก์ชัน fetchExamSheets เพื่อดึงข้อมูลใหม่
        await fetchExamSheets(pageNo); // เรียกฟังก์ชันหลังจากอัปเดตสำเร็จ
      } else {
        console.error("Error updating answer:", response.data.message);
      }
    } catch (error) {
      console.error("Error during update:", error);
    }
  };

  const renderDivs = (position, key, label) => {
    if (!position || label === "id") return null;

    // แปลง `key` เป็น number เพื่อการเปรียบเทียบ
    const parsedKey = parseInt(key);
    const answerDetail = answerDetails.find((item) => item.no === parsedKey);

    if (!answerDetail) return null;

    const displayLabel = answerDetail.label || ""; // ดึงค่า label จาก answerDetails (กรณี null ให้เป็น "")
    const modelread = answerDetail.Predict || ""; // ดึงค่า Predict จาก answerDetails (กรณี null ให้เป็น "")

    const isCorrect = modelread.toLowerCase() === displayLabel.toLowerCase();
    const backgroundButtonColor = isCorrect ? "#89eaa3" : "#ef8c98";
    const borderButtonColor = isCorrect ? "#60c67c" : "#dc7480";

    const hoverStyle = isCorrect
      ? {
          backgroundColor: "#79d993",
        }
      : {
          backgroundColor: "#e4808b",
        };

    const buttonBaseStyle = {
      backgroundColor: backgroundButtonColor,
      borderColor: borderButtonColor,
      transition: "all 0.3s ease",
    };

    const handleHover = (e, hover) => {
      Object.assign(e.target.style, hover ? hoverStyle : buttonBaseStyle);
    };
    // หากเป็น Array ของโพซิชัน (หลายตำแหน่ง)
    if (Array.isArray(position[0])) {
      // รวมโพซิชันทั้งหมดเข้าด้วยกัน (หา min/max)
      const minX = Math.min(...position.map((pos) => pos[0]));
      const minY = Math.min(...position.map((pos) => pos[1]));
      const maxX = Math.max(...position.map((pos) => pos[2]));
      const maxY = Math.max(...position.map((pos) => pos[3]));

      return (
        //2 digit
        <div>
          <Button
            key={key}
            className="label-boxes-button-style"
            style={{
              left: (minX / 2480) * A4_WIDTH,
              top: (minY / 3508) * A4_HEIGHT - 51,
              width: ((maxX - minX) / 2480) * A4_WIDTH * 1.0,
              height: ((maxY - minY) / 3508) * A4_HEIGHT * 0.65,
            }}
            type="text"
          >
            {displayLabel}
          </Button>
          <Button
            className="predict-boxes-button-style"
            style={{
              ...buttonBaseStyle,
              left: (minX / 2480) * A4_WIDTH,
              top: (minY / 3508) * A4_HEIGHT - 27,
              width: ((maxX - minX) / 2480) * A4_WIDTH * 1.0, // ขนาดตาม min/max
              height: ((maxY - minY) / 3508) * A4_HEIGHT * 0.65, // ขนาดตาม min/max
            }}
            type="text"
            onMouseEnter={(e) => handleHover(e, true)}
            onMouseLeave={(e) => handleHover(e, false)}
            onClick={() =>
              handleCheck(modelread, displayLabel, answerDetail.Ans_id)
            }
          ></Button>
        </div>
      );
    } else {
      const isSentence = displayLabel.split(" ").length > 1;

      return (
        //1 digit and sentence

        <div>
          <Button
            className="label-boxes-button-style"
            key={key}
            style={{
              left: (position[0] / 2487) * A4_WIDTH,
              top: (position[1] / 3508) * A4_HEIGHT - 50, // เพิ่มค่าการขยับขึ้น (เปลี่ยนจาก -30 เป็น -50)
              width: ((position[2] - position[0]) / 2480) * A4_WIDTH, // ลดขนาดลง 80% ของเดิม
              height: ((position[3] - position[1]) / 3508) * A4_HEIGHT * 0.65,
              justifyContent: isSentence ? "flex-start" : "center",
              padding: isSentence ? "0 10px" : "0",
            }}
            type="text"
          >
            {displayLabel}
          </Button>
          <Button
            className="predict-boxes-button-style"
            style={{
              ...buttonBaseStyle,
              left: (position[0] / 2487) * A4_WIDTH,
              top: (position[1] / 3508) * A4_HEIGHT - 26,
              width: ((position[2] - position[0]) / 2480) * A4_WIDTH, // ลดขนาดลง 80% ของเดิม
              height: ((position[3] - position[1]) / 3508) * A4_HEIGHT * 0.65,

              justifyContent: isSentence ? "flex-start" : "center",
              padding: isSentence ? "0 10px" : "0",
            }}
            type="text"
            onMouseEnter={(e) => handleHover(e, true)}
            onMouseLeave={(e) => handleHover(e, false)}
            onClick={() =>
              handleCheck(modelread, displayLabel, answerDetail.Ans_id)
            }
          >
            {modelread}
          </Button>
        </div>
      );
    }
  };

  return (
    <>
      {Object.entries(positions).map(([key, value]) =>
        renderDivs(value.position, key, value.label)
      )}
    </>
  );
};

export default OverlayBoxes;