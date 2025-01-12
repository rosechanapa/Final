import React from "react";
import { Flex, Menu } from "antd";
import { Link, useNavigate } from "react-router-dom";
import icon from "../img/icon.png";
import "./Sidebar.css";

// MUI Icons
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import DescriptionIcon from "@mui/icons-material/Description";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DashboardIcon from "@mui/icons-material/Dashboard";
import FolderSharedIcon from "@mui/icons-material/FolderShared";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import SourceIcon from "@mui/icons-material/Source";

const Sidebar = ({ collapsed }) => {
  const navigate = useNavigate();

  const menuItems = [
    // กลุ่ม (Group) ที่ 1
    {
      type: "group",
      key: "g1",
      label: <span className="menu-group-title">Subject</span>, // ชื่อหัวข้อ Group
      children: [
        {
          key: "1",
          icon: (
            <FileCopyIcon
              className="menu-item-icon"
              style={{ fontSize: "21px", color: "#273b56" }}
            />
          ),
          label: (
            <Link to="/Subject">
              <span className="menu-item-text">รายวิชาทั้งหมด</span>
            </Link>
          ),
        },
      ],
    },
    { type: "divider" },

    // กลุ่ม (Group) ที่ 2
    {
      type: "group",
      key: "g2",
      label: <span className="menu-group-title">Create</span>,
      children: [
        {
          key: "2",
          icon: (
            <NoteAddIcon
              className="menu-item-icon"
              style={{ fontSize: "21px", color: "#273b56" }}
            />
          ),
          label: (
            <Link to="/ExamPart">
              <span className="menu-item-text">สร้างกระดาษคำตอบ</span>
            </Link>
          ),
        },
        {
          key: "3",
          icon: (
            <DescriptionIcon
              className="menu-item-icon"
              style={{ fontSize: "21px", color: "#273b56" }}
            />
          ),
          label: (
            <Link to="/viewExamsheet">
              <span className="menu-item-text">กระดาษคำตอบที่สร้าง</span>
            </Link>
          ),
        },
      ],
    },
    { type: "divider" },

    // กลุ่ม (Group) ที่ 3
    {
      type: "group",
      key: "g3",
      label: <span className="menu-group-title">Label</span>,
      children: [
        {
          key: "4",
          icon: (
            <SourceIcon
              className="menu-item-icon"
              style={{ fontSize: "21px", color: "#273b56" }}
            />
          ),
          label: (
            <Link to="/EditLabel">
              <span className="menu-item-text">เฉลยของข้อสอบ</span>
            </Link>
          ),
        },
      ],
    },
    { type: "divider" },

    // กลุ่ม (Group) ที่ 4
    {
      type: "group",
      key: "g4",
      label: <span className="menu-group-title">Detection</span>,
      children: [
        {
          key: "5",
          icon: (
            <UploadFileIcon
              className="menu-item-icon"
              style={{ fontSize: "21px", color: "#273b56" }}
            />
          ),
          label: (
            <Link to="/uploadExamsheet">
              <span className="menu-item-text">อัปโหลดกระดาษคำตอบ</span>
            </Link>
          ),
        },
      ],
    },
    { type: "divider" },

    // กลุ่ม (Group) ที่ 5
    {
      type: "group",
      key: "g5",
      label: <span className="menu-group-title">recheck</span>,
      children: [
        {
          key: "6",
          icon: (
            <CheckCircleIcon
              className="menu-item-icon"
              style={{ fontSize: "21px", color: "#273b56" }}
            />
          ),
          label: (
            <Link to="/Recheck">
              <span className="menu-item-text">recheck</span>
            </Link>
          ),
        },
      ],
    },
    { type: "divider" },

    // กลุ่ม (Group) ที่ 6
    {
      type: "group",
      key: "g6",
      label: <span className="menu-group-title">Analytics</span>,
      children: [
        {
          key: "7",
          icon: (
            <DashboardIcon
              className="menu-item-icon"
              style={{ fontSize: "21px", color: "#273b56" }}
            />
          ),
          label: (
            <Link to="/StudentFile">
              <span className="menu-item-text">คะแนนนักศึกษา</span>
            </Link>
          ),
        },
        {
          key: "8",
          icon: (
            <FolderSharedIcon
              className="menu-item-icon"
              style={{ fontSize: "21px", color: "#273b56" }}
            />
          ),
          label: (
            <Link to="/Analyze">
              <span className="menu-item-text">ภาพรวมคะแนน</span>
            </Link>
          ),
        },
      ],
    },
    { type: "divider" },
  ];

  return (
    <>
      {/* ส่วน Logo */}
      <Flex
        align="center"
        justify="start"
        className={`logo-container ${collapsed ? "collapsed" : ""}`}
      >
        <div
          className="logo"
          onClick={() => navigate("/Subject")}
          style={{ cursor: "pointer" }}
        >
          <img src={icon} className="logo-img" alt="Logo" />
        </div>
        <div className="logo-text">Exam Grading</div>
      </Flex>

      {/* ส่วน Menu ที่ใช้ items แทน children */}
      <Menu
        mode="inline"
        defaultSelectedKeys={["1"]}
        className="menu-bar"
        items={menuItems}
      />
    </>
  );
};

export default Sidebar;
