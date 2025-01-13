import React, { useState, useEffect } from "react";
import { Button, Layout } from "antd";
import { MenuUnfoldOutlined, MenuFoldOutlined } from "@ant-design/icons";
import Sidebar from "./components/Sidebar";
import ViewExamsheet from "./pages/ViewExamsheet";
import UploadExamsheet from "../src/pages/UploadExamsheet";
import ExamPart from "./pages/createSheet/ExamPart";
import LoopPart from "../src/pages/createSheet/LoopPart";
import Generate from "../src/pages/createSheet/Generate";
import Subject from "../src/pages/Subject";
import EditLabel from "./pages/EditLabel";
import StudentFile from "./pages/StudentFile";
import Recheck from "./pages/Recheck";
import "./App.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { socket } from "./socket";

const { Sider, Content } = Layout;
function App() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // เมื่อคอมโพเนนต์ mount ให้ทำงานครั้งเดียว
    socket.on("connect", () => {
      console.log("Connected to socket server with id:", socket.id);
    });

    return () => {
      socket.off("connect");
    };
  }, []);

  return (
    <Router>
      <Layout>
        <Sider
          theme="light"
          trigger={null}
          collapsible
          collapsed={collapsed}
          collapsedWidth={90}
          className={`sider ${collapsed ? "collapsed" : ""}`}
        >
          <Sidebar />

          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className=" triger-btn"
          />
        </Sider>

        <Layout className="layout-content ">
          <Content className="content">
            <Routes>
              <Route path="/Subject" element={<Subject />} />
              <Route path="/" element={<Subject />} />
              <Route path="/UploadExamsheet" element={<UploadExamsheet />} />
              <Route path="/ViewExamsheet" element={<ViewExamsheet />} />
              <Route path="/EditLabel" element={<EditLabel />} />
              <Route path="/ExamPart" element={<ExamPart />} />
              <Route path="/LoopPart" element={<LoopPart />} />
              <Route path="/Generate" element={<Generate />} />
              <Route path="/StudentFile" element={<StudentFile />} />
              <Route path="/Recheck" element={<Recheck />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
}

export default App;
