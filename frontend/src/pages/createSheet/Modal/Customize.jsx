import React, { useState } from "react";
import { Modal, Tabs, Checkbox, Pagination } from "antd";
import ".././.././../css/Customize.css";
import Button from "../.././../components/Button";
const { TabPane } = Tabs;

const Customize = ({ visible, onClose, rangeInput }) => {
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

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

    const visiblePoints = points.slice(startIndex, endIndex); // ข้อมูลในหน้านี้
    const rows = [];

    // สร้างแถวและคอลัมน์
    for (let row = 0; row < itemsPerColumn; row++) {
      const rowItems = [];
      for (let col = 0; col < columns; col++) {
        const itemIndex = row + col * itemsPerColumn; // ดัชนีของแต่ละรายการในหน้า
        if (visiblePoints[itemIndex] !== undefined) {
          rowItems.push(
            <Checkbox
              key={visiblePoints[itemIndex]}
              checked={selectedPoints.includes(visiblePoints[itemIndex])}
              onChange={() => handleCheckboxChange(visiblePoints[itemIndex])}
              style={{
                fontSize: "16px", // ขยายตัวเลข
              }}
            >
              {visiblePoints[itemIndex]}
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
            gap: "10px",
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
      width={800}
      bodyStyle={{
        height: "800px", // เพิ่มความสูง
        // ป้องกันการล้นหน้าจอ
      }}
      className="custom-modal-customize"
    >
      <Tabs defaultActiveKey="1" centered>
        {/* Tab สำหรับ Single Point */}
        <TabPane
          tab={<div className="custom-tab active-tab">Single point</div>}
          key="1"
        >
          {renderCheckboxGroup(points.slice(startIndex, endIndex))}{" "}
          {/* แสดงตามหน้า */}
          <Pagination
            current={currentPage}
            pageSize={columns * itemsPerColumn}
            total={points.length}
            onChange={(page) => setCurrentPage(page)}
            style={{ textAlign: "center", marginTop: "10px" }}
          />
        </TabPane>

        {/* Tab สำหรับ Group Point */}
        <TabPane tab={<div className="custom-tab">Group point</div>} key="2">
          {renderCheckboxGroup(points.slice(startIndex, endIndex))}
          <Pagination
            current={currentPage}
            pageSize={itemsPerPage}
            total={points.length}
            onChange={(page) => setCurrentPage(page)}
            style={{ textAlign: "center", marginTop: "10px" }}
          />
        </TabPane>
      </Tabs>
      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <Button variant="primary" size="sm" onClick={onClose}>
          บันทึก
        </Button>
      </div>
    </Modal>
  );
};

export default Customize;
