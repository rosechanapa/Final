import React, { useEffect, useState } from "react";
import { Button } from "antd";

const A4_WIDTH = 600; // กำหนดค่าความกว้าง
const A4_HEIGHT = (A4_WIDTH / 793.7) * 1122.5; // คำนวณความสูงสัมพันธ์กับความกว้าง

const OverlayBoxes = ({ subjectId, pageNo, answerDetails }) => {
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

    const renderDivs = (position, key, label) => {
        if (!position || label === "id") return null;

        // แปลง `key` เป็น number เพื่อการเปรียบเทียบ
        const parsedKey = parseInt(key);
        const answerDetail = answerDetails.find((item) => item.no === parsedKey);

        if (!answerDetail) return null;

        const displayLabel = answerDetail.label || ""; // ดึงค่า label จาก answerDetails (กรณี null ให้เป็น "")
        const modelread = answerDetail.Predict || "";  // ดึงค่า Predict จาก answerDetails (กรณี null ให้เป็น "")
        
        // แปลงเป็นพิมพ์เล็กทั้งหมดก่อนเปรียบเทียบ
        const isCorrect = modelread.toLowerCase() === displayLabel.toLowerCase();

        const backgroundButtonColor = isCorrect ? "#67da85" : "#f3707f"; // สีพื้นหลัง
        const borderButtonColor = isCorrect ? "#58c876" : "#df5f6e"; // สีกรอบ

        // หากเป็น Array ของโพซิชัน (หลายตำแหน่ง)
        if (Array.isArray(position[0])) {
        // รวมโพซิชันทั้งหมดเข้าด้วยกัน (หา min/max)
        const minX = Math.min(...position.map((pos) => pos[0])); // ด้านซ้ายสุด
        const minY = Math.min(...position.map((pos) => pos[1])); // ด้านบนสุด
        const maxX = Math.max(...position.map((pos) => pos[2])); // ด้านขวาสุด
        const maxY = Math.max(...position.map((pos) => pos[3])); // ด้านล่างสุด

        return (
            //2 digit
            <div>
                <div
                    key={key}
                    className="label-boxes-button-style"
                    style={{
                    left: (minX / 2480) * A4_WIDTH,
                    top: (minY / 3508) * A4_HEIGHT - 45, // เพิ่มค่าการขยับขึ้น
                    width: ((maxX - minX) / 2480) * A4_WIDTH * 1.0, // ขนาดตาม min/max
                    height: ((maxY - minY) / 3508) * A4_HEIGHT * 0.7, // ขนาดตาม min/max
                    }}
                    type="text"
                >
                    {displayLabel}
                </div>
                <Button
                    className="predict-boxes-button-style"
                    style={{
                    backgroundColor: backgroundButtonColor,
                    borderColor: borderButtonColor,
                    left: (minX / 2480) * A4_WIDTH,
                    top: (minY / 3508) * A4_HEIGHT - 21,
                    width: ((maxX - minX) / 2480) * A4_WIDTH * 1.0, // ขนาดตาม min/max
                    height: ((maxY - minY) / 3508) * A4_HEIGHT * 0.7, // ขนาดตาม min/max
                    }}
                >
                    {modelread}
                </Button>
            </div>
        );
        } else {
        return (
            //1 digit
            <div>
                <div
                    className="label-boxes-button-style"
                    key={key}
                    style={{
                    left: (position[0] / 2480) * A4_WIDTH,
                    top: (position[1] / 3508) * A4_HEIGHT - 48, // เพิ่มค่าการขยับขึ้น (เปลี่ยนจาก -30 เป็น -50)
                    width: ((position[2] - position[0]) / 2480) * A4_WIDTH, // ลดขนาดลง 80% ของเดิม
                    height: ((position[3] - position[1]) / 3508) * A4_HEIGHT * 0.65,
                    }}
                    type="text"
                >
                    {displayLabel}
                </div>
                <Button
                    className="predict-boxes-button-style"
                    style={{
                    backgroundColor: backgroundButtonColor,
                    borderColor: borderButtonColor,
                    left: (position[0] / 2480) * A4_WIDTH,
                    top: (position[1] / 3508) * A4_HEIGHT - 23,
                    width: ((position[2] - position[0]) / 2480) * A4_WIDTH, // ลดขนาดลง 80% ของเดิม
                    height: ((position[3] - position[1]) / 3508) * A4_HEIGHT * 0.65,
                    }}
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