import { Flex, Menu } from "antd";
import React from "react";
import icon from "../img/icon.png";
import { Link } from "react-router-dom"; // นำเข้า Link จาก react-router-dom
import "./Sidebar.css";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import DescriptionIcon from "@mui/icons-material/Description";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import TaskIcon from "@mui/icons-material/Task";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DashboardIcon from "@mui/icons-material/Dashboard";
import FolderSharedIcon from "@mui/icons-material/FolderShared";
const Sidebar = ({ collapsed }) => {
  return (
    <>
      <Flex
        align="center"
        justify="start"
        className={`logo-container ${collapsed ? "collapsed" : ""}`}
      >
        <div className="logo">
          <img src={icon} className="logo-img" alt="Logo" />
        </div>
        <div className="logo-text">Exam Grading</div>
      </Flex>

      <Menu mode="inline" defaultSelectedKeys={["1"]} className="menu-bar">
        <Menu.ItemGroup
          key="g1"
          title={<span className="menu-group-title">Create</span>}
        >
          <Menu.Item
            key="1"
            icon={
              <NoteAddIcon
                className="menu-item-icon"
                style={{ fontSize: "21px", color: "#273b56" }}
              />
            }
          >
            {" "}
            <Link to="/CreateExamsheet">
              <span className="menu-item-text">Create exam sheet</span>
            </Link>
          </Menu.Item>
          <Menu.Item
            key="2"
            icon={
              <DescriptionIcon
                className="menu-item-icon"
                style={{ fontSize: "21px", color: "#273b56" }}
              />
            }
          >
            <Link to="/viewExamsheet">
              <span className="menu-item-text">Exam sheet</span>
            </Link>
          </Menu.Item>
        </Menu.ItemGroup>
        <Menu.Divider />

        <Menu.ItemGroup
          key="g2"
          title={<span className="menu-group-title">Detection</span>}
        >
          <Menu.Item
            key="3"
            icon={
              <UploadFileIcon
                className="menu-item-icon"
                style={{ fontSize: "21px", color: "#273b56" }}
              />
            }
          >
            <Link to="/uploadExamsheet">
              <span className="menu-item-text">Upload exam sheet</span>
            </Link>
          </Menu.Item>
        </Menu.ItemGroup>
        <Menu.Divider />

        <Menu.ItemGroup
          key="g3"
          title={<span className="menu-group-title">Label</span>}
        >
          <Menu.Item
            key="4"
            icon={
              <TaskIcon
                className="menu-item-icon"
                style={{ fontSize: "21px", color: "#273b56" }}
              />
            }
          >
            <span className="menu-item-text">Label</span>
          </Menu.Item>
        </Menu.ItemGroup>

        <Menu.Divider />

        <Menu.ItemGroup
          key="g4"
          title={<span className="menu-group-title">recheck</span>}
        >
          <Menu.Item
            key="5"
            icon={
              <CheckCircleIcon
                className="menu-item-icon"
                style={{ fontSize: "21px", color: "#273b56" }}
              />
            }
          >
            <span className="menu-item-text">recheck</span>
          </Menu.Item>
        </Menu.ItemGroup>

        <Menu.Divider />

        <Menu.ItemGroup
          key="g5"
          title={<span className="menu-group-title">Analytics</span>}
        >
          <Menu.Item
            key="6"
            icon={
              <DashboardIcon
                className="menu-item-icon"
                style={{ fontSize: "21px", color: "#273b56" }}
              />
            }
          >
            <span className="menu-item-text"> Dashboard</span>
          </Menu.Item>
          <Menu.Item
            key="7"
            icon={
              <FolderSharedIcon
                className="menu-item-icon"
                style={{ fontSize: "21px", color: "#273b56" }}
              />
            }
          >
            <Link to="/Exam_Part">
              <span className="menu-item-text">Student score</span>
            </Link>
          </Menu.Item>
        </Menu.ItemGroup>

        <Menu.Divider />
      </Menu>
    </>
  );
};

export default Sidebar;
