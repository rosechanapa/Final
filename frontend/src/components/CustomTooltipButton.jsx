import React, { useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import Button from "../components/Button";
const CustomTooltipButton = ({ handleAddClick, index }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        marginLeft: "20px",
      }}
    >
      <Button
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => handleAddClick(index)}
        style={{
          backgroundColor: "#1890ff",
          border: "none",
          color: "white",
          padding: "10px",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        <EditIcon />
      </Button>
      {isHovered && (
        <div
          style={{
            position: "absolute",
            top: "-40px", // แสดง Tooltip ด้านบนปุ่ม
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            color: "#fff",
            padding: "5px 10px",
            borderRadius: "5px",
            whiteSpace: "nowrap",
            fontSize: "12px",
            zIndex: 1000,
          }}
        >
          สำหรับจัดการรูปแบบคะแนนตามใจ
        </div>
      )}
    </div>
  );
};

export default CustomTooltipButton;
