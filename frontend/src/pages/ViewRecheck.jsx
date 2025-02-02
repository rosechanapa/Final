import "../css/recheck.css";
import { Table, Select, message, Input, Modal } from "antd";
import React, { useState, useEffect } from "react";
import axios from "axios";
import Button from "../components/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import { PlusOutlined, MinusOutlined } from "@ant-design/icons";

const { Option } = Select;
const { Search } = Input;

const ViewRecheck = () => {
    const [subjectId, setSubjectId] = useState("");
    const [subjectList, setSubjectList] = useState([]);
    const [pageList, setPageList] = useState([]);
    const [pageNo, setPageNo] = useState(null);

    const [tableData, setTableData] = useState([]);
    
    const [selectedImage, setSelectedImage] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [scale, setScale] = useState(1);

    const [searchText, setSearchText] = useState("");


    // ดึงข้อมูลรหัสวิชา
    useEffect(() => {
        const fetchSubjects = async () => {
            try {
                const response = await axios.get("http://127.0.0.1:5000/get_subjects");
                setSubjectList(response.data);
            } catch (error) {
                console.error("Error fetching subjects:", error);
                message.error("เกิดข้อผิดพลาดในการดึงข้อมูลรหัสวิชา");
            }
        };

        fetchSubjects();
    }, []);

    // ดึงข้อมูลหน้ากระดาษเมื่อเลือก subjectId
    useEffect(() => {
        const fetchPages = async () => {
            if (subjectId) {
                try {
                    const response = await axios.get(`http://127.0.0.1:5000/get_pages/${subjectId}`);
                    setPageList(response.data);
                } catch (error) {
                    console.error("Error fetching pages:", error);
                    message.error("เกิดข้อผิดพลาดในการดึงข้อมูลหน้ากระดาษ");
                }
            } else {
                setPageList([]);
            }
        };

        fetchPages();
    }, [subjectId]);
 

    const fetchpaper = async (value) => {
        if (!subjectId || !value) {
            message.error("กรุณาเลือกรหัสวิชาและหมายเลขหน้ากระดาษให้ครบถ้วน");
            return;
        }
    
        try {
            const response = await axios.post("http://127.0.0.1:5000/get_listpaper", {
                subjectId: subjectId,
                pageNo: value,
            });
    
            const data = response.data;
            console.log("Fetched paper details:", data);
            setTableData(data); // กำหนดข้อมูล array ตรง ๆ
            //message.success("ดึงข้อมูลสำเร็จ!");
        } catch (error) {
            console.error("Error fetching paper details:", error);
            message.error("ไม่มีกระดาษที่ตรวจแล้ว");
        }
    };

    const handleImageClick = (sheetId, pageNo) => {
        const fullImageUrl = `http://127.0.0.1:5000/show_imgcheck?subjectId=${subjectId}&pageNo=${pageNo}&sheetId=${sheetId}`;
        console.log("Generated Full Image URL:", fullImageUrl);
        setSelectedImage(fullImageUrl);
        setScale(1.2);
        setIsModalVisible(true);
    };    

    const handleCloseModal = () => {
        setSelectedImage(null);
        setIsModalVisible(false);
    };

    const increaseZoom = () => {
        setScale((prevScale) => {
          const newScale = Math.min(prevScale + 0.1, 5);
          document.querySelector("div").scrollTop = 0; // รีเซ็ตการเลื่อนเมื่อซูม
          return newScale;
        });
    };
    
    const decreaseZoom = () => {
        setScale((prevScale) => Math.max(prevScale - 0.1, 1)); // ลดขนาดภาพ
    };

    const handleDownload = (imageId) => {
        //console.log(`Downloading: ${subjectId}, ${pageNo}, ${imageId}`);
        window.location.href = `http://127.0.0.1:5000/download_paper/${subjectId}/${pageNo}/${imageId}`;
    };
    
    const handleDownloadPDF = () => {
        const pdfUrl = `http://127.0.0.1:5000/download_paperpdf/${subjectId}/${pageNo}`;
        window.location.href = pdfUrl;  // ดาวน์โหลดไฟล์ PDF
    };    

    // ฟังก์ชันที่อัปเดตค่า searchText ทุกครั้งที่ผู้ใช้พิมพ์
    const handleSearch = (event) => {
        setSearchText(event.target.value);
    };

    // ฟิลเตอร์ข้อมูลทุกครั้งที่ searchText เปลี่ยนแปลง
    const filteredData = tableData.filter((item) =>
        item.Student_id.toString().includes(searchText.trim())
    );

    const highlightText = (text, searchValue) => {
        // ตรวจสอบและแปลง text เป็น string หากไม่ใช่ string
        if (typeof text !== "string") text = String(text);
        if (!searchValue) return text; // ถ้าไม่มีคำค้นหา แสดงข้อความปกติ
        const regex = new RegExp(`(${searchValue})`, "gi"); // สร้าง regex สำหรับคำค้นหา
        const parts = text.split(regex); // แยกข้อความตามคำค้นหา
        return parts.map((part, index) =>
          part.toLowerCase() === searchValue.toLowerCase() ? (
            <span key={index} style={{ backgroundColor: "#d7ebf8" }}>
              {part}
            </span>
          ) : (
            part
          )
        );
    };
     
    
    
    const columns = [
        {
            title: <div style={{ paddingLeft: "20px" }}>รหัสนักศึกษา</div>,
            dataIndex: "Student_id", // ใช้ Student_id จาก response
            key: "id",
            width: 70,
            render: (text) => (
                <div style={{ paddingLeft: "20px" }}>
                  {highlightText(text, searchText)}
                </div>
            ),
        },
        {
            title: "ตัวอย่างภาพ",
            dataIndex: "Sheet_id",
            key: "image_path",
            width: 150,
            render: (sheetId) => (
                <img
                    src={`http://127.0.0.1:5000/show_imgcheck?subjectId=${subjectId}&pageNo=${pageNo}&sheetId=${sheetId}`}
                    alt="Example"
                    className="show-img"
                    style={{ width: "100px", height: "auto" }}
                    onClick={() => handleImageClick(sheetId, pageNo)}
                />
            ),
        },
        {
            title: <div style={{ paddingLeft: "20px" }}>คะแนน</div>,
            dataIndex: "score", // ใช้ score จาก response
            key: "score",
            width: 30,
            render: (text) => <div style={{ paddingLeft: "20px" }}>{text}</div>,
        },
        {
            title: "Action",
            key: "action",
            width: 150,
            render: (record) => (
                <div style={{ display: "flex", gap: "10px" }}>
                    <Button 
                        size="edit" 
                        varian="primary"
                        onClick={() => handleDownload(record.Sheet_id)}
                    >
                        <DownloadIcon />
                    </Button>
                </div>
            ),
        },
    ];
    



    return (
        <div>
            <h1 className="Title">กระดาษคำตอบที่ตรวจ</h1>
            <div className="input-group-std">
                <div className="dropdown-group">
                    <label className="label-std">วิชา: </label>
                    <Select
                        className="custom-select"
                        value={subjectId || undefined}
                        onChange={(value) => setSubjectId(value)}
                        placeholder="กรุณาเลือกรหัสวิชา..."
                        style={{ width: 280, height: 35 }}
                    >
                        {subjectList.map((subject) => (
                            <Option key={subject.Subject_id} value={subject.Subject_id}>
                                {subject.Subject_id} ({subject.Subject_name})
                            </Option>
                        ))}
                    </Select>
                </div>
                <div className="dropdown-group-view">
                    <label className="label-std">เลขหน้า: </label>
                    <Select
                        className="custom-select"
                        value={pageNo || undefined}
                        onChange={(value) => {
                            setPageNo(value);
                            fetchpaper(value); // เรียกฟังก์ชัน fetchpaper เมื่อเลือกหน้ากระดาษ
                        }}
                        placeholder="กรุณาเลือกหน้ากระดาษคำตอบ..."
                        style={{ width: 240, height: 35 }}
                    >
                        {pageList.map((page) => (
                            <Option key={page.page_no} value={page.page_no}>
                                หน้า {page.page_no}
                            </Option>
                        ))}
                    </Select>
                </div>

                <div className="button-group-view-recheck">
                <Button
                    variant="primary"
                    size="view-btt"
                    onClick={handleDownloadPDF}
                    style={{ display: "flex", alignItems: "center" }}
                >
                    Download all
                    <DownloadIcon style={{ fontSize: "18px", marginLeft: " 10px" }} />
                </Button>

                </div>
            </div>
            <div className="Search-Export-container">
                <Search
                    className="custom-search"
                    placeholder="ค้นหา Student ID..."
                    allowClear
                    value={searchText} // ค่าของช่องค้นหา
                    onChange={handleSearch} // เรียก handleSearch ทุกครั้งที่พิมพ์
                    style={{ width: "330px" }}
                />
            </div>


            <Table
                dataSource={filteredData} // ใช้ข้อมูลที่กรองแล้ว
                columns={columns}
                rowKey={(record) => `${record.Sheet_id}-${record.Student_id}`} // ใช้ Sheet_id และ Student_id ร่วมกันเพื่อให้ key ไม่ซ้ำ
                pagination={{ pageSize: 5 }}
                className="custom-table"
            />

            {isModalVisible && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        overflow: "auto",
                    }}
                    onClick={handleCloseModal}
                >
                {console.log("Selected Image in Modal:", selectedImage)}
                {selectedImage ? (
                    <div
                        style={{
                            position: "relative",
                            textAlign: "center",
                        }}
                    >
                        {/* รูปภาพ */}
                        <img
                            src={selectedImage}
                            alt="Full Size"
                            style={{
                            maxWidth: "80vw",
                            maxHeight: "80vh",
                            transform: `scale(${scale})`,
                            transition: "transform 0.3s ease-in-out",
                            objectFit: "contain",
                            transformOrigin: "center",
                            }}
                        />

                        {/* ปุ่มควบคุมการซูม */}
                        <div
                            style={{
                            position: "absolute",
                            bottom: "20px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            display: "flex",
                            gap: "10px",
                            }}
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation(); // หยุดการแพร่กระจายของเหตุการณ์
                                    decreaseZoom();
                                }}
                                style={{
                                    background: "white",
                                    border: "1px solid #ccc",
                                    borderRadius: "50%",
                                    width: "40px",
                                    height: "40px",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    cursor: "pointer",
                                }}
                            >
                                <MinusOutlined />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation(); // หยุดการแพร่กระจายของเหตุการณ์
                                    increaseZoom();
                                }}
                                style={{
                                    background: "white",
                                    border: "1px solid #ccc",
                                    borderRadius: "50%",
                                    width: "40px",
                                    height: "40px",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    cursor: "pointer",
                                }}
                                >
                                <PlusOutlined />
                            </button>
                        </div>
                    </div>
                ) : (
                    <p style={{ color: "white" }}>Loading image...</p>
                )}
                </div>
            )}
        </div>
    );
};

export default ViewRecheck;