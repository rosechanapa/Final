import React, { useState } from "react";
import { Modal, Tabs, Checkbox, Pagination, Table, message } from "antd";
import ".././.././../css/Customize.css";
import Button from "../.././../components/Button";
import DeleteIcon from "@mui/icons-material/Delete";

const { TabPane } = Tabs;

const Customize = ({ visible, onClose, start, rangeInput }) => {
  const [selectedPoints, setSelectedPoints] = useState([]); // State เก็บค่าที่ถูกเลือก
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("1");
  const [groupPoints, setGroupPoints] = useState([]); // State เก็บข้อมูลของกลุ่มจุดที่เพิ่ม
  const [selectionStart, setSelectionStart] = useState(null); // จุดเริ่มต้นของการเลือก

  const columns = 4;
  const itemsPerColumn = 5; // จำนวนรายการในแต่ละคอลัมน์
  const itemsPerPage = columns * itemsPerColumn;
  //const points = Array.from({ length: rangeInput }, (_, i) => i + 1); // สร้าง array ของจุดจาก rangeInput

  // สร้าง array ของจุดตาม start และ rangeInput
  const points = Array.from({ length: rangeInput }, (_, i) => start + i + 1);
  const handleCheckboxChange = (point) => {
    if (selectionStart === null) {
      // หากยังไม่มีจุดเริ่มต้น ให้ตั้งค่าเป็น point ปัจจุบัน
      setSelectionStart(point);
    } else {
      // หากมีจุดเริ่มต้นแล้ว ให้เลือกช่วงระหว่าง selectionStart และ point
      const start = Math.min(selectionStart, point);
      const end = Math.max(selectionStart, point);
      const range = Array.from(
        { length: end - start + 1 },
        (_, i) => start + i
      );

      setSelectedPoints((prev) => [
        ...new Set([...prev, ...range]), // รวมค่าที่เลือกไว้ก่อนหน้านี้กับช่วงใหม่
      ]);
      setSelectionStart(null); // Reset จุดเริ่มต้น
    }
  };
  const renderCheckboxGroup = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const visiblePoints = points.slice(startIndex, endIndex);
    const rows = [];

    const allSelected =
      selectedPoints.length ===
      points.filter(
        (point) => !groupPoints.some((group) => group.includes(point))
      ).length;

    const handleSelectAll = () => {
      const selectablePoints = points.filter(
        (point) => !groupPoints.some((group) => group.includes(point))
      );
      setSelectedPoints(
        (prev) =>
          selectedPoints.length === selectablePoints.length
            ? [] // Deselect all
            : selectablePoints // Select all
      );
    };

    rows.push(
      <div
        key="select-all"
        style={{
          marginLeft: "30px",
          fontSize: "30px",
          marginBottom: "30px",
          textAlign: "left",
        }}
      >
        <Checkbox checked={allSelected} onChange={handleSelectAll} />
        <span className="Text-modal">Select All</span>
      </div>
    );

    for (let row = 0; row < itemsPerColumn; row++) {
      const rowItems = [];
      for (let col = 0; col < columns; col++) {
        const itemIndex = row + col * itemsPerColumn;
        if (visiblePoints[itemIndex] !== undefined) {
          const isDisabled = groupPoints.some((group) =>
            group.includes(visiblePoints[itemIndex])
          );
          rowItems.push(
            <Checkbox
              key={visiblePoints[itemIndex]}
              checked={
                selectedPoints.includes(visiblePoints[itemIndex]) || isDisabled
              }
              onChange={() => handleCheckboxChange(visiblePoints[itemIndex])}
              disabled={isDisabled}
              style={{
                display: "flex",
                alignItems: "center",
                marginLeft: "30px",
                marginBottom: "30px",
                color: isDisabled ? "gray" : "inherit",
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
    if (selectedPoints.length > 0) {
      setGroupPoints((prev) => [...prev, selectedPoints]);
      message.success(
        `จับกลุ่มข้อ ${formatRange(selectedPoints)} เรียบร้อยแล้ว`
      );
      setSelectedPoints([]); // Clear selections after adding
      setSelectionStart(null); // Reset selection start
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
  const formatRange = (points) => {
    if (points.length === 0) return "";
    const sortedPoints = [...points].sort((a, b) => a - b); // จัดเรียงตัวเลข
    const ranges = [];
    let start = sortedPoints[0];
    let end = sortedPoints[0];

    for (let i = 1; i < sortedPoints.length; i++) {
      if (sortedPoints[i] === end + 1) {
        // หากเลขถัดไปต่อเนื่อง
        end = sortedPoints[i];
      } else {
        // หากเลขถัดไปไม่ต่อเนื่อง
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = sortedPoints[i];
        end = sortedPoints[i];
      }
    }

    // เพิ่มช่วงสุดท้าย
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return ranges.join(", ");
  };
  const groupData = groupPoints.map((group, index) => ({
    key: index,
    group: `Group ${index + 1}: ข้อ ${formatRange(group)}`,
  }));

  return (
    <Modal
      title="Customize"
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      bodyStyle={{ height: "600px" }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
        centered
      >
        <TabPane
          tab={
            <Button
              variant={activeTab === "1" ? "primary" : "light-disabled"}
              size="custom"
            >
              Add Group
            </Button>
          }
          key="1"
        >
          {renderCheckboxGroup()} {/* Render Checkbox */}
          <Pagination
            current={currentPage}
            pageSize={itemsPerPage}
            total={points.length}
            onChange={(page) => setCurrentPage(page)}
            showSizeChanger={false}
            style={{ textAlign: "center", marginTop: "10px" }}
          />
          <div style={{ textAlign: "center", marginTop: "30px" }}>
            <Button variant="primary" size="sm" onClick={handleAddGroup}>
              เพิ่มกลุ่ม
            </Button>
          </div>
        </TabPane>

        <TabPane
          tab={
            <Button
              variant={activeTab === "2" ? "primary" : "light-disabled"}
              size="custom"
            >
              View Group
            </Button>
          }
          key="2"
        >
          <Table
            columns={groupColumns}
            dataSource={groupData}
            pagination={{ pageSize: 5 }}
            style={{ marginTop: "10px" }}
            className="custom-table"
          />
        </TabPane>
      </Tabs>
    </Modal>
  );
};

export default Customize;
