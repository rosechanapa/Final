import React, { useState } from "react";
import { Modal, Tabs, Checkbox, Pagination, Table } from "antd";
import ".././.././../css/Customize.css";
import Button from "../.././../components/Button";
import DeleteIcon from "@mui/icons-material/Delete";

const { TabPane } = Tabs;

const Customize = ({ visible, onClose, rangeInput }) => {
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("1");
  const [groupPoints, setGroupPoints] = useState([]); // สำหรับเก็บข้อมูลของกลุ่ม
  const [startPoint, setStartPoint] = useState(""); // เก็บจุดเริ่มต้น
  const [endPoint, setEndPoint] = useState(""); // เก็บจุดสิ้นสุด

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

  const handleAddGroup = () => {
    if (startPoint && endPoint && startPoint <= endPoint) {
      const newGroup = { start: startPoint, end: endPoint };
      setGroupPoints((prev) => [...prev, newGroup]);
      setStartPoint("");
      setEndPoint("");
    }
  };

  const handleDeleteGroup = (index) => {
    setGroupPoints((prev) => prev.filter((_, i) => i !== index));
  };
  const groupColumns = [
    { title: "Group", dataIndex: "group", key: "group" },
    {
      title: "Action",
      key: "action",
      render: (_, record, index) => (
        <Button
          variant="danger"
          size="edit"
          onClick={() => handleDeleteGroup(index)}
        >
          <DeleteIcon />
        </Button>
      ),
    },
  ];
  const groupData = groupPoints.map((group, index) => ({
    key: index,
    group: `ข้อที่ ${group.start} - ${group.end}`,
  }));
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
          <div className="Group-Container">
            <div className="input-group-container">
              <h3 className="grouplabel">ข้อที่ </h3>
              <input
                className="input-groupbox"
                type="number"
                min="0"
                placeholder="ข้อเริ่มต้น..."
                value={startPoint}
                onChange={(e) => setStartPoint(e.target.value)}
              />
              <span className="colon">:</span>{" "}
              <input
                className="input-groupbox"
                type="number"
                min="0"
                placeholder="ข้อสิ้นสุด..."
                value={endPoint}
                onChange={(e) => setEndPoint(e.target.value)}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddGroup}
                style={{ marginTop: "10px", marginLeft: "10px" }}
              >
                เพิ่ม
              </Button>
            </div>
          </div>

          <Table
            columns={groupColumns}
            dataSource={groupData}
            pagination={{ pageSize: 5 }}
            style={{ marginTop: "30px", width: "100%" }}
            className="custom-table"
          />
        </TabPane>
      </Tabs>
      {activeTab === "1" && (
        <div style={{ textAlign: "center", marginTop: "30px" }}>
          <Button variant="primary" size="sm" onClick={onClose}>
            บันทึก
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default Customize;
