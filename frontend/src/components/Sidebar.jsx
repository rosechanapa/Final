import React, { useState, useEffect } from "react";
import { Flex, Menu, message, Modal, Spin } from "antd";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { DeleteOutlined, LoadingOutlined } from "@ant-design/icons";
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
import TaskIcon from "@mui/icons-material/Task";

const Sidebar = ({ collapsed }) => {
  const navigate = useNavigate();
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const location = useLocation();
  const [selectedKey, setSelectedKey] = useState(location.pathname);

  const showDeleteModal = () => {
    setIsDeleteModalVisible(true);
  };
  useEffect(() => {
    if (
      location.pathname.startsWith("/ExamPart") ||
      location.pathname.startsWith("/LoopPart") ||
      location.pathname.startsWith("/Generate")
    ) {
      setSelectedKey("/ExamPart"); // ✅ ให้ถือว่าเป็นส่วนของ /ExamPart
    } else {
      setSelectedKey(location.pathname);
    }
  }, [location.pathname]);
  const handleDeleteDatabase = async () => {
    setLoading(true);
    setLoadingPage(true);

    try {
      const response = await fetch("http://127.0.0.1:5000/delete_all", {
        method: "DELETE",
      });

      const result = await response.json();
      if (response.ok) {
        message.success(result.message);
        setTimeout(() => {
          window.location.reload(); // ✅ รีเฟรชหน้าเมื่อสำเร็จ
        }, 1000);
      } else {
        message.error(result.message || "เกิดข้อผิดพลาดในการลบข้อมูล");
      }
    } catch (error) {
      message.error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
      setIsDeleteModalVisible(false);
      setLoadingPage(false); // ✅ หยุด Spinner
    }
  };

  const menuItems = [
    // กลุ่ม (Group) ที่ 1
    {
      type: "group",
      key: "g1",
      label: <span className="menu-group-title">Subject</span>, // ชื่อหัวข้อ Group
      children: [
        {
          key: "/Subject",
          icon: <FileCopyIcon className="menu-item-icon" />,
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
          key: "/ExamPart",
          icon: <NoteAddIcon className="menu-item-icon" />,
          label: (
            <Link to="/ExamPart">
              <span className="menu-item-text">สร้างกระดาษคำตอบ</span>
            </Link>
          ),
        },
        {
          key: "/ViewExamsheet",
          icon: <DescriptionIcon className="menu-item-icon" />,
          label: (
            <Link to="/ViewExamsheet">
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
          key: "/EditLabel",
          icon: <SourceIcon className="menu-item-icon" />,
          label: (
            <Link to="/EditLabel">
              <span className="menu-item-text">เฉลยข้อสอบ</span>
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
          key: "/uploadExamsheet",
          icon: <UploadFileIcon className="menu-item-icon" />,
          label: (
            <Link to="/uploadExamsheet">
              <span className="menu-item-text">อัปโหลด/ตรวจข้อสอบ</span>
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
          key: "/Recheck",
          icon: <CheckCircleIcon className="menu-item-icon" />,
          label: (
            <Link to="/Recheck">
              <span className="menu-item-text">recheck</span>
            </Link>
          ),
        },
        {
          key: "/ViewRecheck",
          icon: <TaskIcon className="menu-item-icon" />,
          label: (
            <Link to="/ViewRecheck">
              <span className="menu-item-text">กระดาษคำตอบที่ตรวจ</span>
            </Link>
          ),
        },
      ],
    },
    { type: "divider" },

    {
      type: "group",
      key: "g6",
      label: <span className="menu-group-title">Analytics</span>,
      children: [
        {
          key: "/StudentFile",
          icon: <FolderSharedIcon className="menu-item-icon" />,
          label: (
            <Link to="/StudentFile">
              <span className="menu-item-text">เพิ่ม/Export คะแนน</span>
            </Link>
          ),
        },
        {
          key: "/Analyze",
          icon: <DashboardIcon className="menu-item-icon" />,
          label: (
            <Link to="/Analyze">
              <span className="menu-item-text">ภาพรวมคะแนน</span>
            </Link>
          ),
        },
      ],
    },
    { type: "divider" },

    {
      type: "group",
      key: "g7",
      label: <span className="menu-group-title">Delete</span>,
      children: [
        {
          key: "delete_db",
          className: "delete-menu-item",
          icon: <DeleteOutlined className="delete-icon" />,
          label: <span className="delete-text">ลบ Database</span>,
          onClick: () => showDeleteModal(),
        },
      ],
    },
  ];

  return (
    <>
      {loadingPage && (
        <div className="loading-overlay">
          <Spin
            indicator={
              <LoadingOutlined
                style={{ fontSize: 50, color: "#1890ff" }}
                spin
              />
            }
          />
          <p>กำลังลบฐานข้อมูล...</p>
        </div>
      )}
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
        selectedKeys={[selectedKey]} // ให้ Sidebar เปลี่ยนสีตามเส้นทาง
        defaultSelectedKeys={["/Subject"]} // กำหนดค่าเริ่มต้น
        className="menu-bar"
        items={menuItems}
      />
      <Modal
        title="ยืนยันการลบ Database"
        open={isDeleteModalVisible}
        onOk={handleDeleteDatabase}
        onCancel={() => setIsDeleteModalVisible(false)}
        okText="ลบ"
        cancelText="ยกเลิก"
        confirmLoading={loading}
        width={450}
        className="custom-modal"
      >
        <p>
          คุณแน่ใจหรือไม่ว่าต้องการลบ Database ทั้งหมด?
          ข้อมูลทั้งหมดจะหายไปและไม่สามารถกู้คืนได้
        </p>
      </Modal>
    </>
  );
};

export default Sidebar;
