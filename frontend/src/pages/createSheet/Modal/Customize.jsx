import React, { useState, useEffect, useRef } from "react";
import { Modal, Tabs, Checkbox, Pagination, Table, message } from "antd";
import ".././.././../css/Customize.css";
import Button from "../.././../components/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoIcon from "@mui/icons-material/Info";

const Customize = ({
  visible,
  onClose,
  start,
  rangeInput,
  typePointArray,
  rangeInputArray,
  setModalPoint,
  caseArray,
}) => {
  const [selectedPoints, setSelectedPoints] = useState([]); // State เก็บค่าที่ถูกเลือก
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("1");
  const [groupPoints, setGroupPoints] = useState([]); // State เก็บข้อมูลของกลุ่มจุดที่เพิ่ม
  const [singlePoints, setSinglePoints] = useState([]);

  const [Pointarray1, setPointarray1] = useState([]);
  const [Pointarray2, setPointarray2] = useState([]);

  //const [Case_type, setCase_type] = useState({});
  const Case_typeRef = useRef({});
  const [tempPart, settempPart] = useState({});
  const [typingTimeout, setTypingTimeout] = useState(null);

  // เก็บค่าก่อนหน้าของ typePointArray
  const prevTypePointArrayRef = useRef();
  const prevCaseArrayRef = useRef();

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

  const validateAndFilterPoints = () => {
    const tempArray = []; // เก็บตัวเลขที่อยู่ในช่วงของ "Customize"
    const tempObject = {}; // เก็บค่าในรูปแบบ {i: caseArray[index]}
    const tempPart = {}; // เก็บค่าในรูปแบบ {i: เลข index}

    // คำนวณช่วงตัวเลขทั้งหมดและเก็บใน tempArray
    let cumulativeSum = 1; // ตัวเลขเริ่มต้น
    rangeInputArray.forEach((range, index) => {
      const rangeStart = cumulativeSum; // ช่วงเริ่มต้น
      const rangeEnd = rangeStart + parseInt(range) - 1; // ช่วงสิ้นสุด

      if (typePointArray[index] === "Customize") {
        for (let i = rangeStart; i <= rangeEnd; i++) {
          tempArray.push(i); // เก็บตัวเลขในช่วง "Customize"
          tempObject[i] = parseInt(caseArray[index]); // เพิ่มค่าลงใน tempObject
          tempPart[i] = index + 1;
        }
      }

      cumulativeSum = rangeEnd + 1; // อัปเดตค่าถัดไป
    });

    //console.log("Temp Array (Customize Range):", tempArray);
    //console.log("Case Type Object:", tempObject);

    // เซ็ตค่า case_type ลงใน state
    //setCase_type(tempObject); // อัปเดตค่า state
    Case_typeRef.current = tempObject;
    settempPart(tempPart);

    //console.log("Updated Case_type (Ref):", Case_typeRef.current);

    // กรอง GroupPoints และ SinglePoints
    const newGroupPoints = [];
    const newPointarray1 = [];

    groupPoints.forEach((group, index) => {
      if (group.every((point) => tempArray.includes(point))) {
        newGroupPoints.push(group);
        newPointarray1.push(Pointarray1[index]);
      }
    });

    const newSinglePoints = [];
    const newPointarray2 = [];

    singlePoints.forEach((single, index) => {
      if (single.every((point) => tempArray.includes(point))) {
        newSinglePoints.push(single);
        newPointarray2.push(Pointarray2[index]);
      }
    });

    // อัปเดตเฉพาะเมื่อมีการเปลี่ยนแปลงค่า
    if (JSON.stringify(groupPoints) !== JSON.stringify(newGroupPoints)) {
      setGroupPoints(newGroupPoints);
      setPointarray1(newPointarray1);
    }
    if (JSON.stringify(singlePoints) !== JSON.stringify(newSinglePoints)) {
      setSinglePoints(newSinglePoints);
      setPointarray2(newPointarray2);
    }

    //console.log("Filtered Group Points:", newGroupPoints);
    //console.log("Filtered Single Points:", newSinglePoints);
  };

  useEffect(() => {
    //console.log("Received typePointArray:", typePointArray);
    //console.log("Received rangeInputArray:", rangeInputArray);
    //console.log("Received caseArray:", caseArray);

    const arraysAreDifferent = (arr1, arr2) => {
      if (!arr1 || !arr2 || arr1.length !== arr2.length) return true;
      return arr1.some((val, index) => val !== arr2[index]);
    };

    // ตรวจสอบว่ามีการเปลี่ยนแปลงใน typePointArray หรือ caseArray
    const isTypePointArrayChanged = arraysAreDifferent(
      prevTypePointArrayRef.current,
      typePointArray
    );

    const isCaseArrayChanged = arraysAreDifferent(
      prevCaseArrayRef.current,
      caseArray
    );

    // ถ้าไม่มีการเปลี่ยนแปลงใดๆ ให้หยุดทำงาน
    if (!isTypePointArrayChanged && !isCaseArrayChanged) return;

    // เรียกฟังก์ชัน validateAndFilterPoints
    validateAndFilterPoints();

    // อัปเดตค่า reference
    prevTypePointArrayRef.current = [...typePointArray];
    prevCaseArrayRef.current = [...caseArray];

    // เรียก handleSendData หลังจากอัปเดตข้อมูล
    handleSendData();
  }, [typePointArray, caseArray]); //[caseArray]); //[rangeInputArray, typePointArray]); // ลด dependencies ให้เหลือเฉพาะตัวที่จำเป็น

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
        <span className="Text-modal">เลือกทั้งหมด</span>
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
            singlePoints.some((group) =>
              group.includes(visiblePoints[itemIndex])
            );

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
              <span className="no-customize">{visiblePoints[itemIndex]}</span>
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
        //console.log("Updated Pointarray2:", updatedArray);
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
        //console.log("Updated Pointarray1:", updatedArray); // log Pointarray1
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
    setPointarray1((prev) => prev.filter((_, i) => i !== index));
    message.success(`ลบ Group เรียบร้อยแล้ว`);
  };

  const handleDeleteSingle = (index) => {
    setSinglePoints((prev) => prev.filter((_, i) => i !== index));
    setPointarray2((prev) => prev.filter((_, i) => i !== index));
    message.success(`ลบ Single Point เรียบร้อยแล้ว`);
  };

  const groupColumns = [
    {
      title: <div style={{ paddingLeft: "20px" }}>Part</div>,
      dataIndex: "round",
      key: "round",
      render: (text) => <div style={{ paddingLeft: "20px" }}>{text}</div>,
    },
    { title: "ข้อ", dataIndex: "group", key: "group" },
    {
      title: (
        <div style={{ display: "flex", alignItems: "center" }}>
          คะแนน (หลายข้อ/คะแนน)
          <InfoIcon
            className="modal-info-customize"
            style={{
              cursor: "pointer",
              color: "#b8c8e6",
            }}
            onClick={() => {
              Modal.info({
                title: (
                  <div className="modal-info-customize-head-des">
                    ใช้สำหรับการให้คะแนนแบบ Group point
                  </div>
                ),
                width: 480,
                className: "custom-modal",
                content: (
                  <div>
                    <p className="Customize-score-modal">
                      การให้คะแนนแบบ Group point
                      หมายความว่าผู้ใช้ต้องการให้ผู้สอบตอบถูกทุกข้อในกลุ่มนั้นจึงจะได้รับคะแนนตามที่ผู้ใช้ระบุ
                      เช่น ข้อ x - y นักศึกษาต้องตอบถูกทุกข้อ
                      จึงจะได้คะแนนเต็มตามที่ผู้ใช้ระบุ เป็นต้น
                    </p>
                  </div>
                ),
                onOk() {},
              });
            }}
          />
        </div>
      ),
      key: "point_input",
      render: (_, record) => (
        <input
          type="number"
          placeholder="ใส่คะแนน"
          style={{ textAlign: "center" }}
          onChange={(e) => {
            console.log("onChange triggered"); // ตรวจสอบว่า onChange ทำงานหรือไม่
            const value = e.target.value;
            handleGroupPointChange(record.key, value);
          }} // ใช้ `record.key` เป็น index
          className="input-box-score"
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
      title: <div style={{ paddingLeft: "20px" }}>Part</div>,
      dataIndex: "round",
      key: "round",
      render: (text) => <div style={{ paddingLeft: "20px" }}>{text}</div>,
    },
    {
      title: "ข้อ",
      dataIndex: "group",
      key: "group",
    },
    {
      title: (
        <div style={{ display: "flex", alignItems: "center" }}>
          คะแนน (1ข้อ/คะแนน)
          <InfoIcon
            className="modal-info-customize"
            style={{
              cursor: "pointer",
              color: "#b8c8e6",
            }}
            onClick={() => {
              Modal.info({
                title: (
                  <div className="modal-info-customize-head-des">
                    ใช้สำหรับการให้คะแนนแบบ Single point
                  </div>
                ),
                width: 480,
                className: "custom-modal",
                content: (
                  <div>
                    <p className="Customize-score-modal">
                      การให้คะแนนแบบ Single point คือ การให้คะแนนแต่ละข้อแยกกัน
                      เช่น ผู้ใช้เลือกข้อที่ a - c เป็นแบบ Single point
                      หากนักศึกษาตอบข้อใดถูก
                      จะได้คะแนนของข้อนั้นๆตามที่ผู้ใช้ระบุ เป็นต้น
                    </p>
                  </div>
                ),
                onOk() {},
              });
            }}
          />
        </div>
      ),
      key: "point_input",
      render: (_, record) => (
        <input
          type="number"
          placeholder="ใส่คะแนน"
          style={{ textAlign: "center" }}
          onChange={(e) => {
            console.log("onChange triggered");
            handleSinglePointChange(record.key, e.target.value);
          }}
          className="input-box-score"
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
    if (typingTimeout) clearTimeout(typingTimeout);
    setPointarray1((prev) => {
      const updatedArray = [...prev];
      updatedArray[key] = value; // อัปเดตค่าในตำแหน่ง index ตาม `key`
      console.log("Updated Pointarray1:", updatedArray); // Log ค่า Pointarray1
      return updatedArray;
    });
    setTypingTimeout(
      setTimeout(() => {
        if (value === "") {
          message.error(`Group ${key + 1} point is now empty`, 4);
        } else {
          message.success(`Save point in database for Group ${key + 1}`, 4);
        }
      }, 1000)
    );
  };

  const handleSinglePointChange = (key, value) => {
    if (typingTimeout) clearTimeout(typingTimeout);
    setPointarray2((prev) => {
      const updatedArray = [...prev];
      updatedArray[key] = value;
      console.log("Updated Pointarray2:", updatedArray);
      return updatedArray;
    });
    setTypingTimeout(
      setTimeout(() => {
        if (value === "") {
          message.error(`Single point group ${key + 1} is now empty`, 4);
        } else {
          message.success(
            `Save point in database for single point group ${key + 1}`,
            4
          );
        }
      }, 1000)
    );
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

  const groupData = groupPoints.map((group, index) => {
    // หา tempPart ของตัวเลขที่อยู่ในกลุ่ม
    const partValues = group.map((num) => tempPart[num]).filter(Boolean); // ดึงค่าจาก tempPart เฉพาะที่มี key
    const uniqueParts = [...new Set(partValues)]; // ลบค่าซ้ำ เพื่อให้ได้เฉพาะค่าไม่ซ้ำ

    return {
      key: index, // ใช้ index เป็น key
      round: uniqueParts.join(", ") || "N/A", // รวมค่าที่ได้จาก tempPart (เช่น "1, 2")
      group: `ข้อที่ ${formatRange(group)}`, // ใช้ formatRange เพื่อจัดรูปแบบข้อ
    };
  });

  const singlePointData = singlePoints.map((group, index) => {
    // หา tempPart ของตัวเลขใน singlePoints
    const partValues = group.map((num) => tempPart[num]).filter(Boolean); // ดึงค่าจาก tempPart เฉพาะที่มี key
    const uniqueParts = [...new Set(partValues)]; // ลบค่าซ้ำ เพื่อให้ได้เฉพาะค่าไม่ซ้ำ

    return {
      key: index, // ใช้ index เป็น key
      round: uniqueParts.join(", ") || "N/A", // รวมค่าที่ได้จาก tempPart (เช่น "1")
      group: `ข้อที่ ${formatRange(group)}`, // ใช้ formatRange เพื่อจัดรูปแบบข้อ
    };
  });

  // เรียง groupData ตาม round
  const sortedGroupData = groupData.sort((a, b) => {
    const roundA = parseInt(a.round.split(",")[0]) || Number.MAX_SAFE_INTEGER; // แปลง round เป็นตัวเลข (กรณีที่เป็น N/A จะใช้ค่าใหญ่สุด)
    const roundB = parseInt(b.round.split(",")[0]) || Number.MAX_SAFE_INTEGER;
    return roundA - roundB; // เรียงจากน้อยไปมาก
  });

  // เรียง singlePointData ตาม round
  const sortedSinglePointData = singlePointData.sort((a, b) => {
    const roundA = parseInt(a.round.split(",")[0]) || Number.MAX_SAFE_INTEGER; // แปลง round เป็นตัวเลข
    const roundB = parseInt(b.round.split(",")[0]) || Number.MAX_SAFE_INTEGER;
    return roundA - roundB; // เรียงจากน้อยไปมาก
  });

  const generateModalPointData = () => {
    const modalPoint = {};

    // เพิ่มข้อมูลจาก groupPoints และ Pointarray1
    groupPoints.forEach((group, index) => {
      group.forEach((question) => {
        modalPoint[question] = {
          type: "group",
          order: index,
          point: Pointarray1[index] || 0,
          case: Case_typeRef.current[question] || null,
        };
      });
    });

    // เพิ่มข้อมูลจาก singlePoints และ Pointarray2
    singlePoints.forEach((group, index) => {
      group.forEach((question) => {
        modalPoint[question] = {
          type: "single",
          order: null,
          point: Pointarray2[index] || 0,
          case: Case_typeRef.current[question] || null,
        };
      });
    });

    //console.log("Modal Point:", modalPoint);

    return modalPoint;
  };

  const handleSendData = () => {
    // ใช้ generateModalPointData เพื่อสร้างข้อมูล modalPointData
    const modalPointData = generateModalPointData();

    console.log("Generated modalPointData:", modalPointData); // ตรวจสอบข้อมูล

    // ส่งข้อมูล modalPointData กลับไปยัง LoopPart.jsx ผ่าน setModalPoint
    setModalPoint(modalPointData);

    // ปิด modal
    onClose();
  };

  return (
    <Modal
      title="Customize"
      open={visible}
      onCancel={() => {
        handleSendData();
        onClose();
      }}
      footer={null}
      width={950}
      style={{ height: "auto" }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
        centered
        items={[
          {
            key: "1",
            label: (
              <Button
                variant={activeTab === "1" ? "primary" : "light-cus"}
                size="custom"
              >
                Customize
              </Button>
            ),
            children: (
              <>
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
              </>
            ),
          },
          {
            key: "2",
            label: (
              <Button
                variant={activeTab === "2" ? "primary" : "light-cus"}
                size="custom"
              >
                View Group Point
              </Button>
            ),
            children: (
              <Table
                columns={groupColumns}
                dataSource={sortedGroupData} // ใช้ตัวแปรที่เรียงแล้ว
                pagination={{ pageSize: 5 }}
                style={{ marginTop: "10px" }}
                className="custom-table"
              />
            ),
          },
          {
            key: "3",
            label: (
              <Button
                variant={activeTab === "3" ? "primary" : "light-cus"}
                size="custom"
              >
                View Single Point
              </Button>
            ),
            children: (
              <Table
                columns={singlePointColumns}
                dataSource={sortedSinglePointData} // ใช้ตัวแปรที่เรียงแล้ว
                pagination={{ pageSize: 5 }}
                style={{ marginTop: "10px" }}
                className="custom-table"
              />
            ),
          },
        ]}
      />
    </Modal>
  );
};

export default Customize;
