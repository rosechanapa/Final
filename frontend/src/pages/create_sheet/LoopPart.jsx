import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'; // นำเข้า useNavigate
import { Card, Select } from "antd"; // นำเข้า Select
import "../../css/createExamsheet.css";
import Button from "../../components/Button";

const { Option } = Select;

function LoopPart() {
    const { state } = useLocation();
    const navigate = useNavigate(); // สร้างตัวแปร navigate
    const partCount = state?.part || 0;

    const [partsData, setPartsData] = useState(
        Array.from({ length: partCount }, () => ({
            case: '',
            rangeInput: '',
            typePoint: '',
            option: ''
        }))
    );

    const handleChange = (index, field, value) => {
        const updatedPartsData = [...partsData];
        updatedPartsData[index][field] = value;
    
        if (field === "case") {
            if (value === '2') {
                updatedPartsData[index].option = "number";
            } else if (value === '3') {
                updatedPartsData[index].option = "sentence";
            } else if (value === '4') {
                updatedPartsData[index].option = "character";
            } else {
                updatedPartsData[index].option = "";
            }
        }
    
        setPartsData(updatedPartsData);
    };
    

    const handleSubmit = async () => {
        try {
            const caseArray = partsData.map(part => part.case);
            const rangeInputArray = partsData.map(part => part.rangeInput);
            const typePointArray = partsData.map(part => part.typePoint);
            const optionArray = partsData.map(part => part.option);
    
            await fetch('http://127.0.0.1:5000/submit_parts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    case_array: caseArray,
                    range_input_array: rangeInputArray,
                    type_point_array: typePointArray,
                    option_array: optionArray,
                }),
            });
            
            navigate('/Gen');  // ลบ alert ออกและใช้ navigate ตรงนี้แทน
        } catch (error) {
            console.error('Error submitting data:', error);
        }
    };

    
    return (
        <div>
            <h1 className="Title">สร้างกระดาษคำตอบ_New!</h1>
            <Card
                title="สร้างกระดาษคำตอบที่นี่ ( รองรับรูปแบบกระดาษ A4 ในแนวตั้งเท่านั้น )"
                className="card-edit"
                style={{
                    width: "100%",
                    minHeight: 600,
                    margin: "0 auto",
                    height: "auto",
                }}
            >
                {Array.from({ length: partCount }, (_, i) => (
                    <div key={i} style={{ marginBottom: '20px' }}>

                        <div className="condition-container">   
                            <h2 className="topic">Part ที่ {i + 1}</h2>
                        
                            <div className="condition-group">
                                <div className="input-group">
                                    <h3 className="label">เงื่อนไข : </h3>
                                        <Select
                                            value={partsData[i].case}
                                            onChange={(value) => handleChange(i, "case", value)}
                                            className="custom-select"
                                            placeholder="กรุณาเลือกเงื่อนไข..."
                                            style={{ width: 340, height: 40 }}
                                        >
                                            <Option value="1">1 digit</Option>
                                            <Option value="2">2 digit</Option>
                                            <Option value="3">Long box</Option>
                                            <Option value="4">True or False</Option>
                                        </Select>
                                </div>

                                <div className="input-group">
                                    <h3 className="label">จำนวนข้อ : </h3>
                                    <input
                                        type="number"
                                        value={partsData[i].rangeInput}
                                        onChange={(e) => handleChange(i, 'rangeInput', e.target.value)}
                                        className="input-box"
                                    />
                                </div>
                            </div>

                            <div className="condition-group">
                                <div className="input-group">
                                    <h3 className="label">รูปแบบคะแนน : </h3>
                                    <Select
                                        value={partsData[i].typePoint}
                                        onChange={(value) => handleChange(i, "typePoint", value)}
                                        className="custom-select"
                                        placeholder="กรุณาเลือกรูปแบบคะแนน..."
                                        style={{ width: 340, height: 40 }}
                                    >
                                        <Option value="Single">Single Point</Option>
                                        <Option value="Group">Group Point</Option>
                                    </Select>
                                </div>

                                {partsData[i].case === '1' && (
                                    <>
                                        <div className="input-group">
                                            <h3 className="label">ประเภท : </h3>
                                            <Select
                                                value={partsData[i].option}
                                                onChange={(value) => handleChange(i, 'option', value)}
                                                className="custom-select"
                                                placeholder="กรุณาเลือกประเภท..."
                                                style={{ width: 340, height: 40 }}
                                            >
                                                <Option value="number">ตัวเลข</Option>
                                                <Option value="character">ตัวอักษร</Option>
                                            </Select>
                                        </div>
                                        
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                <div className="Button-container">
                    <Button variant="primary" size="md" onClick={handleSubmit}>
                        สร้าง
                    </Button>
                </div>
            </Card>
        </div>
    );
}

export default LoopPart;
