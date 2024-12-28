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

  const [Pointarray1, setPointarray1] = useState([]);
  const [Pointarray2, setPointarray2] = useState([]);

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
          !singlePoints.some((group) => group.includes(point)) // อัปเดตเงื่อนไข
      ).length;
  
    const handleSelectAll = () => {
      const selectablePoints = points.filter(
        (point) =>
          !groupPoints.some((group) => group.includes(point)) &&
          !singlePoints.some((group) => group.includes(point)) // อัปเดตเงื่อนไข
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
            groupPoints.some((group) => group.includes(visiblePoints[itemIndex])) ||
            singlePoints.some((group) => group.includes(visiblePoints[itemIndex])); // ใช้ some() แทน flatMap()
  
          rowItems.push(
            <Checkbox
              key={visiblePoints[itemIndex]}
              checked={
                selectedPoints.includes(visiblePoints[itemIndex]) || isDisabled
              }
              onChange={() => handleCheckboxChange(visiblePoints[itemIndex])}
              disabled={isDisabled} // ตั้งค่าการ Disabled
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
      setSinglePoints((prev) => {
        const newSingle = [...prev, [...selectedPoints]];
        console.log("Updated Single Points:", newSingle); // log singlePoints
        return newSingle;
      });
      setPointarray2((prev) => {
        const updatedArray = [...prev, 0]; // เพิ่มค่าเริ่มต้นเป็น 0
        console.log("Updated Pointarray2:", updatedArray); 
        return updatedArray;
      });
      message.success(
        `เพิ่ม Single Point: ${selectedPoints.join(", ")} เรียบร้อยแล้ว`
      );
      setSelectedPoints([]);
    } else {
      message.warning("กรุณาเลือกจุดก่อนเพิ่ม Single Point");
    }
  };
  

  const handleAddGroup = () => {
    if (selectedPoints.length > 0) {
      setGroupPoints((prev) => {
        const updatedGroupPoints = [...prev, selectedPoints];
        console.log("Updated Group Points:", updatedGroupPoints); // log groupPoints
        return updatedGroupPoints;
      });
      setPointarray1((prev) => {
        const updatedArray = [...prev, 0]; // เพิ่มค่าเริ่มต้นเป็น 0
        console.log("Updated Pointarray1:", updatedArray); // log Pointarray1
        return updatedArray;
      });
      message.success(
        `จับกลุ่มข้อ ${formatRange(selectedPoints)} เรียบร้อยแล้ว`
      );
      setSelectedPoints([]);
    } else {
      message.warning("กรุณาเลือกจุดก่อนเพิ่มกลุ่ม");
    }
  };

  const handleDeleteGroup = (index) => {
    setGroupPoints((prev) => prev.filter((_, i) => i !== index));
    message.success(`ลบ Group เรียบร้อยแล้ว`);
  };

  const handleDeleteSingle = (index) => {
    setSinglePoints((prev) => prev.filter((_, i) => i !== index));
    message.success(`ลบ Single Point เรียบร้อยแล้ว`);
  };

  const groupColumns = [
    {
      title: <div style={{ paddingLeft: "20px" }}>ครั้งที่</div>,
      dataIndex: "round",
      key: "round",
      render: (text) => <div style={{ paddingLeft: "20px" }}>{text}</div>,
    },
    { title: "ข้อ", dataIndex: "group", key: "group" },
    {
      title: "คะแนน",
      key: "point_input",
      render: (_, record) => (
        <input
          type="number"
          placeholder="ใส่คะแนน"
          style={{ width: "80px", textAlign: "center" }}
          onChange={(e) => handleGroupPointChange(record.key, e.target.value)} // ใช้ `record.key` เป็น index
          className="input-box-mini"
          value={Pointarray1[record.key] || ""} // ใช้ค่าจาก `Pointarray1`
        />
      ),
    },
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
  
  
  const singlePointColumns = [
    {
      title: <div style={{ paddingLeft: "20px" }}>ครั้งที่</div>,
      dataIndex: "round",
      key: "round",
      render: (text) => <div style={{ paddingLeft: "20px" }}>{text}</div>,
    },
    { title: "ข้อ", dataIndex: "group", key: "group" },
    {
      title: "คะแนน",
      key: "point_input",
      render: (_, record) => (
        <input
          type="number"
          placeholder="กรุณาใส่คะแนน"
          style={{ width: "80px", textAlign: "center" }}
          onChange={(e) => handleSinglePointChange(record.key, e.target.value)} // ใช้ `record.key` เป็น index
          className="input-box-mini"
          value={Pointarray2[record.key] || ""} // ใช้ค่าจาก `Pointarray2`
        />
      ),
    },    
    {
      title: "Action",
      key: "action",
      render: (_, record, index) => (
        <Button
          variant="danger"
          size="edit"
          onClick={() => handleDeleteSingle(index)}
        >
          <DeleteIcon />
        </Button>
      ),
    },
  ];  
  
  
  // ฟังก์ชันสำหรับจัดการคะแนน
  const handleGroupPointChange = (key, value) => {
    setPointarray1((prev) => {
      const updatedArray = [...prev];
      updatedArray[key] = value; // อัปเดตค่าในตำแหน่ง index ตาม `key`
      console.log("Updated Pointarray1:", updatedArray); // Log ค่า Pointarray1
      return updatedArray;
    });
  };
  
  const handleSinglePointChange = (key, value) => {
    setPointarray2((prev) => {
      const updatedArray = [...prev];
      updatedArray[key] = value; // อัปเดตค่าในตำแหน่ง index ตาม `key`
      console.log("Updated Pointarray2:", updatedArray); 
      return updatedArray;
    });
  };
  
   
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

  const singlePointData = singlePoints.map((group, index) => ({
    key: index, // ใช้ index เป็น key
    round: `${index + 1}`, // ระบุรอบ
    group: `ข้อที่ ${formatRange(group)}`, // ใช้ formatRange เพื่อจัดรูปแบบข้อ
  }));
  
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
        style={{ height: "600px" }}
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
