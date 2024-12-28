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
  const [singlePoints, setSinglePoints] = useState([]);

  const columns = 4;
  const itemsPerColumn = 5; // จำนวนรายการในแต่ละคอลัมน์
  const itemsPerPage = columns * itemsPerColumn;
  //const points = Array.from({ length: rangeInput }, (_, i) => i + 1); // สร้าง array ของจุดจาก rangeInput

  // สร้าง array ของจุดตาม start และ rangeInput
  const points = Array.from({ length: rangeInput }, (_, i) => start + i + 1);
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

    const allSelected =
      selectedPoints.length ===
      points.filter(
        (point) =>
          !groupPoints.some((group) => group.includes(point)) &&
          !singlePoints.flatMap((group) => group.points).includes(point)
      ).length;

    const handleSelectAll = () => {
      const selectablePoints = points.filter(
        (point) =>
          !groupPoints.some((group) => group.includes(point)) &&
          !singlePoints.flatMap((group) => group.points).includes(point)
      );
      setSelectedPoints(allSelected ? [] : selectablePoints);
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
          const isDisabled =
            groupPoints.some((group) =>
              group.includes(visiblePoints[itemIndex])
            ) ||
            singlePoints
              .flatMap((group) => group.points)
              .includes(visiblePoints[itemIndex]); // Disable ถ้าเป็น Group Point หรือ Single Point
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
  const handleAddSinglePoint = () => {
    if (selectedPoints.length > 0) {
      const round = singlePoints.length + 1;
      setSinglePoints((prev) => [
        ...prev,
        { round, points: [...selectedPoints] },
      ]);
      message.success(
        `เพิ่ม Single Point ครั้งที่ ${round}: ${selectedPoints.join(
          ", "
        )} เรียบร้อยแล้ว`
      );
      setSelectedPoints([]);
    } else {
      message.warning("กรุณาเลือกจุดก่อนเพิ่ม Single Point");
    }
  };

  const handleAddGroup = () => {
    if (selectedPoints.length > 0) {
      setGroupPoints((prev) => [...prev, selectedPoints]);
      message.success(
        `จับกลุ่มข้อ ${formatRange(selectedPoints)} เรียบร้อยแล้ว`
      );
      setSelectedPoints([]);
    }
  };
  const handleDeleteGroup = (index) => {
    setGroupPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteSingle = (roundText) => {
    const round = parseInt(roundText.replace("ครั้งที่ ", ""), 10); // แปลง "ครั้งที่ 2" เป็น 2
    setSinglePoints((prev) => prev.filter((group) => group.round !== round)); // ลบรอบที่ตรงกัน
    message.success(`ลบ Single Point ครั้งที่ ${round} เรียบร้อยแล้ว`);
  };

  const singlePointColumns = [
    {
      title: <div style={{ paddingLeft: "20px" }}>ครั้งที่</div>,
      dataIndex: "round",
      key: "round",
      render: (text) => <div style={{ paddingLeft: "20px" }}>{text}</div>,
    },
    { title: "ข้อ", dataIndex: "single", key: "single" },
    {
      title: "Action",
      key: "action",
      render: (_, record, index) => (
        <Button
          variant="danger"
          size="edit"
          onClick={() => handleDeleteSingle(record.round)}
        >
          <DeleteIcon />
        </Button>
      ),
    },
  ];

  const singlePointData = singlePoints.map((group) => ({
    key: group.round,
    round: `${group.round}`,
    single:
      group.points && group.points.length > 0
        ? `ข้อที่ ${group.points.sort((a, b) => a - b).join(", ")}` // เรียงลำดับตัวเลข
        : "ไม่มีข้อมูล",
  }));

  const groupColumns = [
    {
      title: <div style={{ paddingLeft: "20px" }}>ครั้งที่</div>,
      dataIndex: "round",
      key: "round",
      render: (text) => <div style={{ paddingLeft: "20px" }}>{text}</div>,
    },
    { title: "ข้อ", dataIndex: "group", key: "group" },
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

    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return ranges.join(", ");
  };
  const groupData = groupPoints.map((group, index) => ({
    key: index, // ใช้ index เป็น key
    round: `${index + 1}`, // ระบุรอบ
    group: `ข้อที่ ${formatRange(group)}`, // ใช้ formatRange เพื่อจัดรูปแบบข้อ
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
              Customize
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
          <div
            style={{
              textAlign: "center",
              marginTop: "30px",
            }}
          >
            <Button
              className="Button-Custom"
              variant="light"
              size="sm"
              onClick={handleAddSinglePoint}
            >
              เพิ่ม Single Point
            </Button>
            
            <Button variant="primary" size="sm" onClick={handleAddGroup}>
              เพิ่ม Group Point
            </Button>
          </div>
        </TabPane>

        <TabPane
          tab={
            <Button
              variant={activeTab === "2" ? "primary" : "light-disabled"}
              size="custom"
            >
              View Group Point
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

        <TabPane
          tab={
            <Button
              variant={activeTab === "3" ? "primary" : "light-disabled"}
              size="custom"
            >
              View Single Point
            </Button>
          }
          key="3"
        >
          <Table
            columns={singlePointColumns}
            dataSource={singlePointData}
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
