import React, { useState } from "react";
import { Modal, Tabs, Checkbox, Pagination } from "antd";
import ".././.././../css/Customize.css";
import Button from "../.././../components/Button";
const { TabPane } = Tabs;

const Customize = ({ visible, onClose, rangeInput }) => {
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("1");

  const columns = 4; // จำนวนคอลัมน์
  const itemsPerColumn = 5; // จำนวนรายการต่อคอลัมน์
  const itemsPerPage = columns * itemsPerColumn; // จำนวนรายการต่อหน้า
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const points = Array.from({ length: rangeInput }, (_, i) => i + 1);

  const handleCheckboxChange = (point) => {
    setSelectedPoints((prev) =>
      prev.includes(point) ? prev.filter((p) => p !== point) : [...prev, point]
    );
  };

  const renderCheckboxGroup = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    const visiblePoints = points.slice(startIndex, endIndex);
    const rows = [];

    for (let row = 0; row < itemsPerColumn; row++) {
      const rowItems = [];
      for (let col = 0; col < columns; col++) {
        const itemIndex = row + col * itemsPerColumn;
        if (visiblePoints[itemIndex] !== undefined) {
          rowItems.push(
            <Checkbox
              key={visiblePoints[itemIndex]}
              checked={selectedPoints.includes(visiblePoints[itemIndex])}
              onChange={() => handleCheckboxChange(visiblePoints[itemIndex])}
              style={{
                fontSize: "30px",
                display: "flex",
                alignItems: "center",
                margin: "10px",
              }}
            >
              <span style={{ fontSize: "20px", marginLeft: "22px" }}>
                {visiblePoints[itemIndex]}
              </span>
            </Checkbox>
          );
        }
      }
      rows.push(
        <div
          key={`row-${row}`}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: "50px",
          }}
        >
          {rowItems}
        </div>
      );
    }
    return rows;
  };

  return (
    <Modal
      title="Customize"
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      bodyStyle={{
        height: "600px", // เพิ่มความสูง
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
        centered
      >
        {/* Tab สำหรับ Single Point */}
        <TabPane
          tab={
            <Button
              variant={activeTab === "1" ? "primary" : "light-disabled"}
              size="custom"
            >
              Single point
            </Button>
          }
          key="1"
        >
          {renderCheckboxGroup(points.slice(startIndex, endIndex))}{" "}
          <Pagination
            current={currentPage}
            pageSize={columns * itemsPerColumn}
            total={points.length}
            onChange={(page) => setCurrentPage(page)}
            showSizeChanger={false}
            style={{
              textAlign: "center",
              justifyContent: "flex-end",
              marginTop: "30px",
              marginRight: "20px",
            }}
          />
        </TabPane>

        {/* Tab สำหรับ Group Point */}
        <TabPane
          tab={
            <Button
              variant={activeTab === "2" ? "primary" : "light-disabled"}
              size="custom"
            >
              Group point
            </Button>
          }
          key="2"
        >
          {renderCheckboxGroup(points.slice(startIndex, endIndex))}
          <Pagination
            current={currentPage}
            pageSize={itemsPerPage}
            total={points.length}
            onChange={(page) => setCurrentPage(page)}
            style={{
              textAlign: "center",
              justifyContent: "flex-end",
              marginTop: "50px",
            }}
          />
        </TabPane>
      </Tabs>
      <div style={{ textAlign: "center", marginTop: "30px" }}>
        <Button variant="primary" size="sm" onClick={onClose}>
          บันทึก
        </Button>
      </div>
    </Modal>
  );
};

export default Customize;
