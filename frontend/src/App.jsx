import React, { useState } from "react";
import { Button, Layout } from "antd";
import { MenuUnfoldOutlined, MenuFoldOutlined } from "@ant-design/icons";
import Sidebar from "./components/Sidebar";
import ViewExamsheet from "./pages/ViewExamsheet";
import UploadExamsheet from "./pages/UploadExamsheet";
import CreateExamsheet from "./pages/createExam/CreateExamsheet";
import "./App.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

const { Sider, Content } = Layout;
function App() {
  const [collapsed, setCollapsed] = useState(false);

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
              <Route path="/UploadExamsheet" element={<UploadExamsheet />} />
              <Route path="/ViewExamsheet" element={<ViewExamsheet />} />
              <Route path="/CreateExamsheet" element={<CreateExamsheet />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
}

export default App;
