import React, { useState, useEffect } from "react";
import "../css/editlabel.css";
import { Table, Select, Input, message, Modal, Radio } from "antd";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DoDisturbOnIcon from '@mui/icons-material/DoDisturbOn';
import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges';
import axios from "axios";
import Button from "../components/Button";

const { Option } = Select;

const EditLabel = () => {
  const [dataSource, setDataSource] = useState([]);
  const [subjectList, setSubjectList] = useState([]); // รายชื่อวิชา
  const [subjectId, setSubjectId] = useState(""); // วิชาที่เลือก
  const [editingAnswers, setEditingAnswers] = useState({}); // เก็บค่า input ของแต่ละแถว
  const [editingKey, setEditingKey] = useState(null); // เก็บ label_id ที่กำลังแก้ไข
  const [editingRow, setEditingRow] = useState({}); // เก็บข้อมูลของแถวที่กำลังแก้ไข

  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [selectedOption, setSelectedOption] = React.useState(null);

  // ดึงข้อมูลวิชาทั้งหมด
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:5000/get_subjects");
        const subjects = response.data;
        setSubjectList(subjects);
  
        // ตั้งค่า subjectId เป็น Subject_id แรกที่เจอในรายการ
        if (subjects.length > 0) {
          const firstSubjectId = subjects[0].Subject_id;
          setSubjectId(firstSubjectId);
  
          // ดึงข้อมูล labels สำหรับวิชาแรก
          fetchLabels(firstSubjectId);
        }
      } catch (error) {
        console.error("Error fetching subjects:", error);
      }
    };
    fetchSubjects();
  }, []);
  

  // ดึงข้อมูล label เมื่อเลือกวิชา
  const fetchLabels = async (subjectId) => {
    try {
      const response = await axios.get(`http://127.0.0.1:5000/get_labels/${subjectId}`);
      if (response.data.status === "success") {
        const groupedData = mergeGroupRows(response.data.data); // จัดกลุ่มข้อมูลก่อนแสดง
        setDataSource(groupedData);
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error fetching labels:", error);
      message.error("Failed to fetch labels");
    }
  };

  // เมื่อเลือกวิชา
  const handleSubjectChange = (value) => {
    setSubjectId(value);
    fetchLabels(value); // เรียก API
  };

  // ฟังก์ชันจัดกลุ่มข้อมูล
  const mergeGroupRows = (data) => {
    let groupCounter = 1;
    const groupMap = new Map();
    return data.map((item) => {
      if (item.Group_No !== null) {
        if (!groupMap.has(item.Group_No)) {
          groupMap.set(item.Group_No, `Group ${groupCounter}`);
          groupCounter++;
          return { ...item, Group_Label: groupMap.get(item.Group_No) };
        }
        return { ...item, Group_Label: "" }; // แสดงว่างสำหรับแถวในกลุ่มเดียวกัน
      }
      return { ...item, Group_Label: "Single" }; // สำหรับข้อที่ไม่มี Group
    });
  };

  const handleCheckboxChange = async (labelId, value) => {
    if (!value) {
      console.warn("No value selected for handleCheckboxChange");
      return;
    }
  
    try {
      const response = await axios.put(`http://127.0.0.1:5000/update_label/${labelId}`, {
        Answer: value, // ส่งค่าเดียว
      });
  
      if (response.data.status === "success") {
        message.success("Answer updated successfully");
  
        // อัปเดต DataSource
        setDataSource((prevData) =>
          prevData.map((item) =>
            item.Label_id === labelId ? { ...item, Answer: value } : item
          )
        );
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error updating answer:", error);
      message.error("Failed to update answer");
    }
  };  
  
 
  // ฟังก์ชันส่งข้อมูลเมื่อกดออกจาก input
  const handleAnswerChange = (labelId, value) => {
    if (value === undefined || value === null) {
      console.warn("Received undefined or null value for handleAnswerChange");
      return;
    }
    setEditingAnswers((prev) => ({
      ...prev,
      [labelId]: value,
    }));
  };  
  
  const handleAnswerBlur = async (labelId) => {
    const value = editingAnswers[labelId];
    if (!value) return; // ถ้าไม่มีการเปลี่ยนแปลงค่า ไม่ต้องส่ง request
  
    try {
      const response = await axios.put(`http://127.0.0.1:5000/update_label/${labelId}`, {
        Answer: value,
      });
      if (response.data.status === "success") {
        message.success("Answer updated successfully");
        setDataSource((prevData) =>
          prevData.map((item) =>
            item.Label_id === labelId ? { ...item, Answer: value } : item
          )
        );
        setEditingAnswers((prev) => {
          const newState = { ...prev };
          delete newState[labelId]; // ลบค่าออกจาก state หลังจากบันทึกสำเร็จ
          return newState;
        });
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error updating answer:", error);
      message.error("Failed to update answer");
    }
  };

  const handleEdit = (record) => {
    setEditingKey(record.Label_id); // เก็บ `Label_id` ของแถวที่ต้องการแก้ไข
    setEditingRow({ ...record }); // เก็บข้อมูลของแถวที่ต้องการแก้ไข
  };

  const handleSaveEdit = async () => {
    try {
      const response = await axios.put(`http://127.0.0.1:5000/update_point/${editingRow.Label_id}`, {
        label_id: editingRow.Label_id,
        point: editingRow.Point_single ? parseFloat(editingRow.Point_single) : 0,
      });
  
      if (response.data.status === "success") {
        message.success("บันทึกคะแนนสำเร็จ");
        setEditingKey(null); // ปิดการแก้ไข
        // เรียกฟังก์ชัน fetchLabels เพื่อดึงข้อมูลใหม่
        await fetchLabels(subjectId);
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error updating score:", error);
      message.error("บันทึกคะแนนไม่สำเร็จ");
    }
  };

  const handleSaveFree = async (Label_id) => {
    try {
      // ส่งคำขอ HTTP PUT ไปยัง API
      const response = await axios.put(`http://127.0.0.1:5000/update_free/${Label_id}`, {});
  
      if (response.data.status === "success") {
        // แสดงข้อความสำเร็จ
        message.success("บันทึกข้อฟรีสำเร็จ");
  
        setEditingKey(null); // ปิดการแก้ไข
        // เรียกฟังก์ชัน fetchLabels เพื่อดึงข้อมูลใหม่
        await fetchLabels(subjectId);
      } else {
        // แสดงข้อความข้อผิดพลาดที่ส่งมาจาก API
        message.error(response.data.message || "เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (error) {
      // จัดการข้อผิดพลาดและแสดงข้อความให้ผู้ใช้
      console.error("Error updating free label:", error);
      message.error("บันทึกข้อฟรีไม่สำเร็จ");
    }
  };  

  const showModal = () => {
    setIsModalVisible(true);
  };
  
  const handleOk = async (labelId, selectedOption) => {
    if (selectedOption) {
      try {
        const response = await fetch("http://127.0.0.1:5000/cancel_free", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            label_id: labelId,
            option_value: selectedOption,
          }),
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const data = await response.json();
  
        message.success("ข้อมูลถูกส่งเรียบร้อยแล้ว!");
        setEditingKey(null); // ปิดการแก้ไข
  
        // เรียกฟังก์ชัน fetchLabels เพื่อดึงข้อมูลใหม่
        await fetchLabels(subjectId);
      } catch (error) {
        console.error("Error sending data:", error);
        message.error("เกิดข้อผิดพลาดในการส่งข้อมูล!");
      }
  
      setIsModalVisible(false);
    } else {
      message.error("กรุณาเลือกรูปแบบข้อสอบก่อน!");
    }
  };
  
  
  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleCheck = async (subjectId) => {
    try {
      const response = await axios.post('http://127.0.0.1:5000/update_Check', {
          Subject_id: subjectId // ส่ง Subject_id ใน body
      });
      
      if (response.data.status === "success") {
        message.success("ตรวจข้อสอบเรียบร้อยแล้ว!");

      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      console.error("Error update_Check", error);
      message.error("Failed to update_Check");
    }
  };

  const groupByType = (data) => {
    const groupedData = [];
    const typeHeaders = {
      11: "กรุณากรอกเฉพาะเลข 0 - 9",
      12: "กรุณากรอกเฉพาะตัวอักษร A - Z",
      2: "กรุณากรอกเฉพาะเลข 0 - 9 (สำหรับคำตอบแบบ 2 digit)",
      4: "กรุณากรอกเฉพาะ T หรือ F เท่านั้น",
      51: "กรุณาเลือกข้อ A - D",
      52: "กรุณาเลือกข้อ A - E",
    };
    let runningNo = 1; // เริ่มลำดับตัวเลขข้อจาก 1

    data.forEach((item) => {
      // สร้าง Header หาก Type ยังไม่ถูกจัดกลุ่ม
      if (!groupedData.some((group) => group.Type === item.Type)) {
        if (typeHeaders[item.Type]) {
          groupedData.push({
            key: `header-${item.Type}`,
            isHeader: true,
            Type: item.Type,
            Label: typeHeaders[item.Type],
          });
        }
      }

      // เพิ่มข้อมูลแถวพร้อมกำหนดลำดับตัวเลขข้อ (`No`) แบบต่อเนื่อง
      groupedData.push({ ...item, isHeader: false, No: runningNo });
      runningNo++; // เพิ่มหมายเลขข้อ
    });

    return groupedData;
  };

  const groupedDataSource = groupByType(dataSource);

  const handleKeyDown = (event, currentIndex) => {
    if (event.key === "ArrowDown") {
      // ค้นหา Input ถัดไป
      const nextInput = document.querySelector(
        `[data-index="${currentIndex + 1}"]`
      );
      if (nextInput) {
        event.preventDefault(); // ป้องกันการ scroll ในเบราว์เซอร์
        nextInput.querySelector("input").focus(); // โฟกัสที่องค์ประกอบ input ภายใน Input.OTP
      }
    } else if (event.key === "ArrowUp") {
      // ค้นหา Input ก่อนหน้า
      const prevInput = document.querySelector(
        `[data-index="${currentIndex - 1}"]`
      );
      if (prevInput) {
        event.preventDefault(); // ป้องกันการ scroll ในเบราว์เซอร์
        prevInput.querySelector("input").focus(); // โฟกัสที่องค์ประกอบ input ภายใน Input.OTP
      }
    }
  };


  // คอลัมน์สำหรับแสดงผล
  const columns = [
    {
      title: <div style={{ paddingLeft: "30px" }}>ข้อที่</div>,
      dataIndex: "No",
      key: "No",
      width: 100,
      render: (text, record) => {
        if (record.isHeader) {
          return {
            children: (
              <label
                className="label-table-part"
                style={{ paddingLeft: "30px" }}
              >
                {record.Label}
              </label>
            ),
            props: {
              colSpan: columns.length,
            },
          };
        }
        return {
          children: <div style={{ paddingLeft: "30px" }}>{text}</div>,
          props: {
            colSpan: 1,
          },
        };
      },
    },
    {
      title: "เฉลย",
      dataIndex: "Answer",
      key: "Answer",
      width: 150,
      render: (text, record) => {
        if (record.isHeader) {
          return { props: { colSpan: 0 } };
        }

        const typeString = String(record.Type);
        //console.log("typeString:", typeString);

        switch (typeString) {
          case "11":
            return (
              <>
                <Input.OTP
                  data-index={record.No}
                  length={1}
                  syntax="number"
                  value={editingAnswers[record.Label_id] ?? text}
                  onChange={(value) => {
                    if (/^[0-9]*$/.test(value)) {
                      console.log("Value:", value);
                      handleAnswerChange(record.Label_id, value);
                    } else {
                      message.warning("กรุณากรอกเฉพาะตัวเลข 0-9 เท่านั้น");
                    }
                  }}
                  onBlur={() => handleAnswerBlur(record.Label_id)}
                  onKeyDown={(e) => handleKeyDown(e, record.No)}
                  style={{
                    width: "35px",
                    height: "50px",
                  }}
                />
              </>
            );
          case "12":
            return (
              <>
                <Input.OTP
                  data-index={record.No}
                  length={1}
                  syntax="char"
                  value={editingAnswers[record.Label_id] ?? text}
                  onChange={(value) => {
                    if (/^[a-zA-Z]*$/.test(value)) {
                      const upperValue = value.toUpperCase();
                      console.log("Value:", upperValue);
                      handleAnswerChange(record.Label_id, upperValue);
                    } else {
                      message.warning("กรุณากรอกเฉพาะ A-Z เท่านั้น");
                    }
                  }}
                  onBlur={() => handleAnswerBlur(record.Label_id)}
                  onKeyDown={(e) => handleKeyDown(e, record.No)}
                  style={{
                    width: "35px",
                    height: "50px",
                  }}
                />
              </>
            );
          case "2":
            return (
              <>
                <Input.OTP
                  data-index={record.No}
                  length={2}
                  syntax="number"
                  value={editingAnswers[record.Label_id] ?? text}
                  onChange={(value) => {
                    if (/^[0-9]*$/.test(value)) {
                      console.log("Value:", value);
                      handleAnswerChange(record.Label_id, value);
                    } else {
                      // ใช้ message.warning แทน alert
                      message.warning("กรุณากรอกเฉพาะตัวเลข 0-9 เท่านั้น");
                    }
                  }}
                  onBlur={() => handleAnswerBlur(record.Label_id)}
                  onKeyDown={(e) => handleKeyDown(e, record.No)}
                  style={{
                    width: "100px", // กำหนดความกว้าง
                    height: "50px", // กำหนดความสูง
                  }}
                />
              </>
            );
          case "4":
            return (
              <>
                <Input.OTP
                  data-index={record.No}
                  length={1}
                  syntax="T or F"
                  value={editingAnswers[record.Label_id] ?? text}
                  onChange={(value) => {
                    if (/^[tTfF]*$/.test(value)) {
                      // แปลงข้อความเป็นพิมพ์ใหญ่อัตโนมัติ
                      const upperValue = value.toUpperCase();
                      console.log("Value:", upperValue);
                      handleAnswerChange(record.Label_id, upperValue);
                    } else {
                      // ใช้ message.warning แทน alert
                      message.warning("กรุณากรอกเฉพาะ T หรือ F เท่านั้น");
                    }
                  }}  
                  onBlur={() => handleAnswerBlur(record.Label_id)}
                  onKeyDown={(e) => handleKeyDown(e, record.No)}
                  style={{
                    width: "35px", // ความกว้าง
                    height: "50px", // ความสูง
                  }}
                />
              </>
            );
          case "51":
            return (
              <>
                <Radio.Group
                  options={[
                    { label: "A", value: "A" },
                    { label: "B", value: "B" },
                    { label: "C", value: "C" },
                    { label: "D", value: "D" },
                  ]}
                  value={editingAnswers[record.Label_id] || text} // ค่าเริ่มต้นจากฐานข้อมูล
                  onChange={(e) => {
                    const selectedValue = e.target.value; // ค่าเลือกล่าสุด
                    console.log("Selected Value:", selectedValue);
                    handleCheckboxChange(record.Label_id, selectedValue); // ส่งค่าที่เลือก
                  }}
                  optionType="button" // หรือ "default" หากไม่ต้องการเป็นปุ่ม
                />
              </>
            );
          case "52":
            return (
              <>
                <Radio.Group
                  options={[
                    { label: "A", value: "A" },
                    { label: "B", value: "B" },
                    { label: "C", value: "C" },
                    { label: "D", value: "D" },
                    { label: "E", value: "E" },
                  ]}
                  value={editingAnswers[record.Label_id] || text} // ค่าเริ่มต้นจากฐานข้อมูล
                  onChange={(e) => {
                    const selectedValue = e.target.value; // ค่าเลือกล่าสุด
                    console.log("Selected Value:", selectedValue);
                    handleCheckboxChange(record.Label_id, selectedValue); // ส่งค่าที่เลือก
                  }}
                  optionType="button" // หรือ "default" หากไม่ต้องการเป็นปุ่ม
                />
              </>
            );            
          case "6":
            // ไม่แสดง input
            return null;
          case "free":
            return <label className="label-table-part">FREE</label>;
          default:
            return (
              <Input
                value={editingAnswers[record.Label_id] ?? text} // ใช้ค่าใน state ถ้ามีการแก้ไข
                onChange={(e) => handleAnswerChange(record.Label_id, e.target.value)}
                onBlur={() => handleAnswerBlur(record.Label_id)}
                placeholder="ใส่เฉลย..."
              />
            );
        }
      },
    },        
    {
      title: "คะแนน",
      key: "Points",
      width: 120,
      render: (text, record) => {
        if (record.isHeader) {
          return { props: { colSpan: 0 } };
        }
        // แสดงคะแนนเฉพาะแถวที่ Group_Label ไม่ใช่ ""
        if (record.Group_Label !== "") {
          if (editingKey === record.Label_id) {
            return (
              <input
                className="input-box-score-label"
                type="number"
                value={editingRow.Point_single ?? ""}
                onChange={(e) =>
                  setEditingRow({ ...editingRow, Point_single: e.target.value })
                }
                placeholder="ใส่คะแนน..."
              />
            );
          }
          const points = record.Point_Group ?? record.Point_single;
          return points !== null ? parseFloat(points).toFixed(2) : "ยังไม่มีข้อมูล";
        }
        return null; // ไม่แสดงอะไรเลยหาก Group_Label เป็น ""
      },
    },
    {
      title: "ประเภท",
      dataIndex: "Group_Label",
      key: "Type",
      width: 120,
      render: (text, record) => {
        if (record.isHeader) {
          return { props: { colSpan: 0 } }; // ซ่อนคอลัมน์นี้เมื่อเป็น Header
        }
        return text;
      },
    },
    {
      title: "Action",
      key: "action",
      width: 100,
      render: (_, record) => {
        if (record.isHeader) {
          return { props: { colSpan: 0 } }; // ซ่อนคอลัมน์นี้เมื่อเป็น Header
        }
        const handleOkWrapper = () => handleOk(record.Label_id, selectedOption);
        // แสดงปุ่มเฉพาะแถวที่ Group_Label ไม่ใช่ ""
        if (record.Group_Label !== "") {
          return editingKey === record.Label_id ? (
            <>
              <Button size="edit" varian="primary" onClick={handleSaveEdit}>
                <SaveIcon />
              </Button>
              {record.Type === "free" ? (
                <>
                  <Button
                    size="edit"
                    varian="primary"
                    onClick={showModal}
                  >
                    <DoDisturbOnIcon />
                  </Button>
    
                  <Modal
                    title="ยกเลิกข้อฟรี"
                    visible={isModalVisible}
                    onOk={handleOkWrapper}
                    onCancel={handleCancel}
                    okText="ตกลง"
                    cancelText="ยกเลิก"
                  >
                    <Select
                      placeholder="กรุณาเลือกรูปแบบข้อสอบ..."
                      style={{ width: "100%" }}
                      onChange={(value) => setSelectedOption(value)}
                    >
                      <Option value="11">1 digit (number)</Option>
                      <Option value="12">1 digit (char)</Option>
                      <Option value="2">2 digit</Option>
                      <Option value="3">Long box</Option>
                      <Option value="4">True or False</Option>
                      <Option value="51">multiple choice 4</Option>
                      <Option value="52">multiple choice 5</Option>
                      <Option value="6">line</Option>
                    </Select>
                  </Modal>
                </>
              ) : (
                <Button
                  size="edit"
                  varian="primary"
                  onClick={() => handleSaveFree(record.Label_id)}
                >
                  <CheckCircleIcon />
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                size="edit"
                varian="primary"
                onClick={() => handleEdit(record)}
              >
                <EditIcon />
              </Button>
            </>
          );
        }
        return null; // ไม่แสดงอะไรเลยหาก Group_Label เป็น ""
      },
    }    
    
  ];

  return (
    <div>
      <h1 className="Title">จัดการเฉลยข้อสอบ</h1>
      <div className="input-group-view">
        <div className="dropdown-group">
          <Select
            className="custom-select-std"
            value={subjectId || undefined}
            onChange={handleSubjectChange}
            placeholder="เลือกวิชา"
            style={{ width: 340, height: 40 }}
          >
            {subjectList.map((subject) => (
              <Option key={subject.Subject_id} value={subject.Subject_id}>
                {subject.Subject_name} ({subject.Subject_id})
              </Option>
            ))}
          </Select>
        </div>

        <Button
          variant="primary"
          size="view-btt"
          onClick={() => handleCheck(subjectId)}
          style={{ display: "flex", alignItems: "center" }}
        >
          ตรวจข้อสอบใหม่
          <PublishedWithChangesIcon style={{ fontSize: "18px", marginLeft: " 10px" }} />
        </Button>
      </div>

      <Table
        dataSource={groupedDataSource}
        columns={columns}
        rowKey="Label_id" // ใช้ Label_id เป็นคีย์
        pagination={{ pageSize: 10 }}
        className="custom-table"
      />
    </div>
  );
};

export default EditLabel;