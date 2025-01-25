import React, { useState, useEffect } from "react";
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
  setPointarray1,
  setPointarray2,
  partIndex,
}) => {
  const [selectedPoints, setSelectedPoints] = useState([]); // State เก็บค่าที่ถูกเลือก
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("1");
  // // const [Pointarray1, setPointarray1] = useState([]);
  // // const [Pointarray2, setPointarray2] = useState([]);
  const [groupPoints, setGroupPoints] = useState([]); // [[group1, group2], [group3], ...]
  const [singlePoints, setSinglePoints] = useState([]); // [[point1, point2], [point3], ...]
  const [localPointarray1, setLocalPointarray1] = useState([]); // [[point1, point2], [point3], ...]
  const [localPointarray2, setLocalPointarray2] = useState([]);
  const [Case_type, setCase_type] = useState([]);
  const [typingTimeout, setTypingTimeout] = useState(null);

  const columns = 4;
  const itemsPerColumn = 5; // จำนวนรายการในแต่ละคอลัมน์
  const itemsPerPage = columns * itemsPerColumn;

  // const points = Array.from({ length: rangeInput }, (_, i) => start + i + 1);

  const points = Array.from(
    { length: rangeInput || 0 },
    (_, i) => (start || 0) + i + 1
  );
  const handleCheckboxChange = (point) => {
    setSelectedPoints((prev) =>
      prev.includes(point) ? prev.filter((p) => p !== point) : [...prev, point]
    );
  };

  // const getFilteredData = (data, partIndex) => {
  //   return data.filter((_, index) => index === partIndex);
  // };

  // const filteredGroupPoints = getFilteredData(groupPoints, partIndex);
  // const filteredSinglePoints = getFilteredData(singlePoints, partIndex);
  const filteredGroupPoints = groupPoints[partIndex] || [];
  const filteredSinglePoints = singlePoints[partIndex] || [];
  useEffect(() => {
    console.log(`Customize opened for partIndex: ${partIndex}`);
  }, [partIndex]);
  const validateAndFilterPoints = () => {
    const tempArray = [];
    const case_type = [];

    let cumulativeSum = 1;
    rangeInputArray.forEach((range, index) => {
      const rangeStart = cumulativeSum; // ช่วงเริ่มต้น
      const rangeEnd = rangeStart + parseInt(range) - 1; // ช่วงสิ้นสุด

      if (typePointArray[index] === "Customize") {
        for (let i = rangeStart; i <= rangeEnd; i++) {
          tempArray.push(i); // เก็บตัวเลขในช่วง "Customize"
          case_type.push(parseInt(caseArray[index])); // เพิ่มค่าจาก caseArray
        }
      }

      cumulativeSum = rangeEnd + 1; // อัปเดตค่าถัดไป
    });

    console.log("Temp Array (Customize Range):", tempArray);
    console.log("Case Type Array:", case_type);

    setCase_type(case_type);

    const partGroupPoints = groupPoints[partIndex] || [];
    const partSinglePoints = singlePoints[partIndex] || [];
    const partLocalPointarray1 = localPointarray1[partIndex] || [];
    const partLocalPointarray2 = localPointarray2[partIndex] || [];

    const newGroupPoints = [];
    const newPointarray1 = [];
    const newSinglePoints = [];
    const newPointarray2 = [];

    partGroupPoints.forEach((group, index) => {
      if (group.every((point) => tempArray.includes(point))) {
        newGroupPoints.push(group);
        newPointarray1.push(partLocalPointarray1[index] || "");
      }
    });

    partSinglePoints.forEach((single, index) => {
      if (single.every((point) => tempArray.includes(point))) {
        newSinglePoints.push(single);
        newPointarray2.push(partLocalPointarray2[index] || "");
      }
    });

    if (
      JSON.stringify(groupPoints[partIndex]) !== JSON.stringify(newGroupPoints)
    ) {
      setGroupPoints((prev) => {
        const updated = [...prev];
        updated[partIndex] = [...newGroupPoints]; // ใช้ spread operator เพื่อหลีกเลี่ยงการเบิ้ล
        return updated;
      });
    }

    if (
      JSON.stringify(localPointarray1[partIndex]) !==
      JSON.stringify(newPointarray1)
    ) {
      setLocalPointarray1((prev) => {
        const updated = [...prev];
        updated[partIndex] = [...newPointarray1]; // ใช้ spread operator
        return updated;
      });
    }

    if (
      JSON.stringify(singlePoints[partIndex]) !==
      JSON.stringify(newSinglePoints)
    ) {
      setSinglePoints((prev) => {
        const updated = [...prev];
        updated[partIndex] = [...newSinglePoints]; // ใช้ spread operator
        return updated;
      });
    }

    if (
      JSON.stringify(localPointarray2[partIndex]) !==
      JSON.stringify(newPointarray2)
    ) {
      setLocalPointarray2((prev) => {
        const updated = [...prev];
        updated[partIndex] = [...newPointarray2]; // ใช้ spread operator
        return updated;
      });
    }
  };
  // if (JSON.stringify(groupPoints) !== JSON.stringify(newGroupPoints)) {
  //   setGroupPoints(newGroupPoints);
  //   setLocalPointarray1(newPointarray1);
  // }
  // if (JSON.stringify(singlePoints) !== JSON.stringify(newSinglePoints)) {
  //   setSinglePoints(newSinglePoints);
  //   setLocalPointarray2(newPointarray2);
  // }

  //   console.log("Filtered Group Points:", newGroupPoints);
  //   console.log("Filtered Single Points:", newSinglePoints);
  // };

  useEffect(() => {
    if (rangeInput && start !== undefined) {
      validateAndFilterPoints();
    }
  }, [rangeInput, start, caseArray]);

  // useEffect(() => {
  //   console.log("Received caseArray:", caseArray);

  //   validateAndFilterPoints();
  // }, [caseArray]);

  const renderCheckboxGroup = () => {
    if (!Array.isArray(points) || points.length === 0) {
      return (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          ไม่มีข้อมูลสำหรับการแสดงผล
        </div>
      );
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const visiblePoints = points.slice(startIndex, endIndex);

    const rows = [];

    const allSelected =
      selectedPoints.length ===
      points.filter(
        (point) =>
          !filteredGroupPoints.some((group) => group.includes(point)) &&
          !filteredSinglePoints.some((group) => group.includes(point))
        // !groupPoints.some((group) => group.includes(point)) &&
        // !singlePoints.some((group) => group.includes(point)) // อัปเดตเงื่อนไข
      ).length;

    const handleSelectAll = () => {
      const selectablePoints = points.filter(
        (point) =>
          !filteredGroupPoints.some((group) => group.includes(point)) &&
          !filteredSinglePoints.some((group) => group.includes(point))
        // !groupPoints.some((group) => group.includes(point)) &&
        // !singlePoints.some((group) => group.includes(point)) // อัปเดตเงื่อนไข
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
            filteredGroupPoints.some((group) =>
              group.includes(visiblePoints[itemIndex])
            ) ||
            filteredSinglePoints.some((group) =>
              group.includes(visiblePoints[itemIndex])
            );
          // groupPoints.some((group) =>
          //   group.includes(visiblePoints[itemIndex])
          // ) ||
          // singlePoints.some((group) =>
          //   group.includes(visiblePoints[itemIndex])
          // );

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
  const handleAddSinglePoint = () => {
    if (selectedPoints.length > 0) {
      setSinglePoints((prev) => {
        const updated = [...prev];
        if (!Array.isArray(updated[partIndex])) {
          updated[partIndex] = [];
        }
        updated[partIndex].push(selectedPoints);
        return updated;
      });

      setLocalPointarray2((prev) => {
        const updated = [...prev];
        if (!Array.isArray(updated[partIndex])) {
          updated[partIndex] = [];
        }
        updated[partIndex].push(""); // ค่าเริ่มต้นเป็น ""
        return updated;
      });

      message.success(
        `เพิ่ม Single Point: ${selectedPoints.join(", ")} เรียบร้อยแล้ว`
      );
      setSelectedPoints([]);
    } else {
      message.warning("กรุณาเลือกจุดก่อนเพิ่ม Single Point");
    }
  };
  // const handleAddSinglePoint = () => {
  //   if (selectedPoints.length > 0) {
  //     setSinglePoints((prev) => {
  //       const newSingle = [...prev, [...selectedPoints]];
  //       console.log("Updated Single Points:", newSingle); // log singlePoints
  //       return newSingle;
  //     });
  //     setLocalPointarray2((prev) => {
  //       const updatedArray = [...prev, 0]; // เพิ่มค่าเริ่มต้นเป็น 0
  //       console.log("Updated Pointarray2:", updatedArray);
  //       return updatedArray;
  //     });
  //     message.success(
  //       เพิ่ม Single Point: ${selectedPoints.join(", ")} เรียบร้อยแล้ว
  //     );
  //     setSelectedPoints([]);
  //   } else {
  //     message.warning("กรุณาเลือกจุดก่อนเพิ่ม Single Point");
  //   }
  // };

  // const singlePointData = singlePoints.map((group, index) => ({
  //   key: index, // ใช้ index เป็น key
  //   round: ${index + 1}, // ระบุรอบ
  //   group: ข้อที่ ${formatRange(group)}, // ใช้ formatRange เพื่อจัดรูปแบบข้อ
  // }));
  const singlePointData = filteredSinglePoints.map((group, index) => ({
    key: index,
    round: `${index + 1}`,
    group: `ข้อที่ ${formatRange(group)}`,
  }));

  const handleAddGroup = () => {
    if (selectedPoints.length > 0) {
      setGroupPoints((prev) => {
        const updated = [...prev];
        if (!Array.isArray(updated[partIndex])) {
          updated[partIndex] = [];
        }
        updated[partIndex].push(selectedPoints);
        return updated;
      });

      setLocalPointarray1((prev) => {
        const updated = [...prev];
        if (!Array.isArray(updated[partIndex])) {
          updated[partIndex] = [];
        }
        updated[partIndex].push(""); // ค่าเริ่มต้นเป็น ""
        return updated;
      });

      message.success(
        `จับกลุ่มข้อ ${formatRange(selectedPoints)} เรียบร้อยแล้ว`
      );
      setSelectedPoints([]);
    } else {
      message.warning("กรุณาเลือกจุดก่อนเพิ่มกลุ่ม");
    }
  };

  // const handleAddGroup = () => {
  //   if (selectedPoints.length > 0) {
  //     setGroupPoints((prev) => {
  //       const updatedGroupPoints = [...prev, selectedPoints];
  //       console.log("Updated Group Points:", updatedGroupPoints); // log groupPoints
  //       return updatedGroupPoints;
  //     });
  //     setLocalPointarray1((prev) => {
  //       const updatedArray = [...prev, 0];
  //       console.log("Updated Pointarray1:", updatedArray);
  //       return updatedArray;
  //     });
  //     message.success(
  //       จับกลุ่มข้อ ${formatRange(selectedPoints)} เรียบร้อยแล้ว
  //     );
  //     setSelectedPoints([]);
  //   } else {
  //     message.warning("กรุณาเลือกจุดก่อนเพิ่มกลุ่ม");
  //   }
  // };

  useEffect(() => {
    console.log("groupPoints updated:", groupPoints);
  }, [groupPoints]);

  // const groupData = groupPoints.map((group, index) => ({
  //   key: index,
  //   round: ${index + 1},
  //   group: ข้อที่ ${formatRange(group)},
  // }));
  const groupData = filteredGroupPoints.map((group, index) => ({
    key: index,
    round: `${index + 1}`,
    group: `ข้อที่ ${formatRange(group)}`,
  }));

  // const handleDeleteGroup = (index) => {
  //   setGroupPoints((prev) => prev.filter((_, i) => i !== index));
  //   setLocalPointarray1((prev) => prev.filter((_, i) => i !== index));
  //   message.success(ลบ Group เรียบร้อยแล้ว);
  // };
  const handleDeleteGroup = (index) => {
    const updatedGroupPoints = [...groupPoints];
    const updatedLocalPointarray1 = [...localPointarray1];

    // ตรวจสอบว่า partIndex มีค่าเป็นอาร์เรย์หรือไม่
    if (!Array.isArray(updatedGroupPoints[partIndex])) {
      updatedGroupPoints[partIndex] = [];
    }
    if (!Array.isArray(updatedLocalPointarray1[partIndex])) {
      updatedLocalPointarray1[partIndex] = [];
    }

    // ลบรายการที่ต้องการ
    updatedGroupPoints[partIndex].splice(index, 1);
    updatedLocalPointarray1[partIndex].splice(index, 1);

    // อัปเดต State
    setGroupPoints(updatedGroupPoints);
    setLocalPointarray1(updatedLocalPointarray1);

    message.success(`ลบ Group เรียบร้อยแล้ว`);
  };

  const handleDeleteSingle = (index) => {
    const updatedSinglePoints = [...singlePoints];
    const updatedLocalPointarray2 = [...localPointarray2];

    // ตรวจสอบว่า partIndex มีค่าเป็นอาร์เรย์หรือไม่
    if (!Array.isArray(updatedSinglePoints[partIndex])) {
      updatedSinglePoints[partIndex] = [];
    }
    if (!Array.isArray(updatedLocalPointarray2[partIndex])) {
      updatedLocalPointarray2[partIndex] = [];
    }

    // ลบรายการที่ต้องการ
    updatedSinglePoints[partIndex].splice(index, 1);
    updatedLocalPointarray2[partIndex].splice(index, 1);

    // อัปเดต State
    setSinglePoints(updatedSinglePoints);
    setLocalPointarray2(updatedLocalPointarray2);

    message.success(`ลบ Single Point เรียบร้อยแล้ว`);
  };

  // const handleDeleteSingle = (index) => {
  //   setSinglePoints((prev) => prev.filter((_, i) => i !== index));
  //   setLocalPointarray2((prev) => prev.filter((_, i) => i !== index));
  //   message.success(ลบ Single Point เรียบร้อยแล้ว);
  // };

  const groupColumns = [
    {
      title: <div style={{ paddingLeft: "20px" }}>ครั้งที่</div>,
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
            style={{ marginLeft: 8, cursor: "pointer", color: "#b8c8e6" }}
            onClick={() => {
              Modal.info({
                title: "ใช้สำหรับการให้คะแนนแบบ Group point",
                width: 450,
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
          }} // ใช้ record.key เป็น index
          className="input-box-score"
          value={localPointarray1[partIndex]?.[record.key] || ""}
          // value={filteredPointarray1[record.key] || ""}
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
      title: (
        <div style={{ display: "flex", alignItems: "center" }}>
          คะแนน (1ข้อ/คะแนน)
          <InfoIcon
            style={{ marginLeft: 8, cursor: "pointer", color: "#b8c8e6" }}
            onClick={() => {
              Modal.info({
                title: "ใช้สำหรับการให้คะแนนแบบ Single point",
                width: 450,
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
      render: (_, record) => {
        console.log("Record:", record);
        return (
          <input
            type="number"
            placeholder="ใส่คะแนน"
            style={{ textAlign: "center" }}
            onChange={(e) => {
              console.log("onChange triggered");
              handleSinglePointChange(record.key, e.target.value);
            }}
            className="input-box-score"
            value={localPointarray2[partIndex]?.[record.key] || ""} // ใช้ค่าจาก Pointarray2
            // value={filteredPointarray2[record.key] || ""}
          />
        );
      },
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
    setLocalPointarray1((prev) => {
      const updatedArray = [...prev];
      // ตรวจสอบว่าพาร์ทปัจจุบันมีข้อมูลหรือไม่
      if (!Array.isArray(updatedArray[partIndex])) {
        updatedArray[partIndex] = [];
      }
      updatedArray[partIndex][key] = value; // อัปเดตค่าเฉพาะพาร์ทและกลุ่มที่เกี่ยวข้อง
      return updatedArray;
    });

    if (typingTimeout) clearTimeout(typingTimeout);
    // setLocalPointarray1((prev) => {
    //   const updatedArray = [...prev];
    //   updatedArray[key] = value; // อัปเดตค่าในตำแหน่ง index ตาม key
    //   console.log("Updated Pointarray1:", updatedArray); // Log ค่า Pointarray1
    //   return updatedArray;
    // });
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
    setLocalPointarray2((prev) => {
      const updatedArray = [...prev];
      // ตรวจสอบว่าพาร์ทปัจจุบันมีข้อมูลหรือไม่
      if (!Array.isArray(updatedArray[partIndex])) {
        updatedArray[partIndex] = [];
      }
      updatedArray[partIndex][key] = value; // อัปเดตค่าเฉพาะพาร์ทและจุดที่เกี่ยวข้อง
      return updatedArray;
    });

    // setLocalPointarray2((prev) => {
    //   const updatedArray = [...prev];
    //   updatedArray[key] = value;
    //   console.log("Updated Pointarray2:", updatedArray);
    //   return updatedArray;
    // });
    if (typingTimeout) clearTimeout(typingTimeout);
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

  const generateModalPointData = () => {
    const modalPoint = {};
    let caseIndex = 0;
    groupPoints[partIndex]?.forEach((group, index) => {
      // groupPoints.forEach((group, index) => {
      group.forEach((question) => {
        modalPoint[question] = {
          type: "group",
          order: index,
          point: parseFloat(localPointarray1[partIndex]?.[index]) || 0,
          // point: localPointarray1[index] || 0,
          // point: localPointarray1[partIndex][index] || 0,
          case: Case_type[caseIndex],
        };
        caseIndex++;
      });
    });
    singlePoints[partIndex]?.forEach((group, index) => {
      // singlePoints.forEach((group, index) => {
      group.forEach((question) => {
        modalPoint[question] = {
          type: "single",
          order: null,
          // point: localPointarray2[index] || 0,
          point: parseFloat(localPointarray2[partIndex]?.[index]) || 0,
          // point: localPointarray2[partIndex][index] || 0,
          case: Case_type[caseIndex], // เลือกค่า case จาก Case_type ตาม index
        };
        caseIndex++; // เพิ่ม index ของ Case_type
      });
    });

    return modalPoint;
  };

  const handleSendData = () => {
    const modalPointData = generateModalPointData();

    console.log("Generated modalPointData:", modalPointData); // ตรวจสอบข้อมูล

    setModalPoint(modalPointData);
    setPointarray1((prev) => {
      const updated = [...prev];
      updated[partIndex] = [...(localPointarray1[partIndex] || [])];
      return updated;
    });
    setPointarray2((prev) => {
      const updated = [...prev];
      updated[partIndex] = [...(localPointarray2[partIndex] || [])];
      return updated;
    });

    onClose();
  };

  // useEffect(() => {
  //   setPointarray1(localPointarray1);
  //   setPointarray2(localPointarray2);
  // }, [localPointarray1, localPointarray2]);

  useEffect(() => {
    setPointarray1((prev) => {
      const updated = [...prev];
      updated[partIndex] = localPointarray1[partIndex] || [];
      return updated;
    });

    setPointarray2((prev) => {
      const updated = [...prev];
      updated[partIndex] = localPointarray2[partIndex] || [];
      return updated;
    });
  }, [localPointarray1, localPointarray2, partIndex]);
  return (
    <Modal
      title="Customize"
      open={visible}
      onCancel={() => {
        handleSendData();
        onClose();
      }}
      footer={null}
      width={1000}
      style={{ height: "600px" }}
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
                dataSource={groupData}
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
                dataSource={singlePointData}
                pagination={{ pageSize: 5 }}
                style={{ marginTop: "10px" }}
                className="custom-table"
              />
            ),
          },
        ]}
      />
      ;
    </Modal>
  );
};

export default Customize;
