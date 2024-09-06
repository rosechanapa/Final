import React, { useState } from "react";

function MainApp({ subjectId, pageNumber, imageSrc, onReset }) {
  const [step, setStep] = useState(1);
  const [selectedCase, setSelectedCase] = useState("");
  const [rangeInput, setRangeInput] = useState("");
  const [numLines, setNumLines] = useState(""); // เพิ่ม state สำหรับ num_lines
  const [finalImageSrc, setFinalImageSrc] = useState(imageSrc); // เริ่มต้นด้วยภาพ A

  const handleCaseSelect = (selectedCase) => {
    setSelectedCase(selectedCase);
    setRangeInput(""); // ล้างค่าช่อง input เมื่อเลือกเคสใหม่
    setNumLines(""); // ล้างค่าช่อง num_lines เมื่อเลือกเคสใหม่
    setStep(2);
  };

  const handleGenerate = async () => {
    const response = await fetch("http://127.0.0.1:5000/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        selected_case: selectedCase,
        range_input: rangeInput,
        num_lines: numLines,
      }), // ส่ง num_lines ไปด้วย
    });

    if (response.ok) {
      const data = await response.json();
      setFinalImageSrc(`data:image/png;base64,${data.image}`); // อัพเดทภาพที่สร้างใหม่ (ภาพ B)
      setStep(3);
    } else {
      console.error("Failed to generate image");
    }
  };

  const handleExit = async () => {
    await fetch("http://127.0.0.1:5000/reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    onReset(); // เรียกฟังก์ชัน reset จาก App.js เพื่อกลับไปเริ่มต้นใหม่
  };

  const handleGenerateAgain = async () => {
    setSelectedCase(""); // ล้างค่า selectedCase เพื่อเริ่มต้นใหม่
    setRangeInput(""); // ล้างค่าช่อง input
    setNumLines(""); // ล้างค่าช่อง num_lines
    setStep(1); // กลับไปเริ่มต้นที่ step 1 โดยไม่ออกจาก loop
  };

  return (
    <div>
      {step === 1 && (
        <div>
          <h1>Select case</h1>
          <button onClick={() => handleCaseSelect("Case1")}>Case1</button>
          <button onClick={() => handleCaseSelect("Case2")}>Case2</button>
          <button onClick={() => handleCaseSelect("Case3")}>Case3</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h1>Select range</h1>
          <div>
            <label>range_input: </label>
            <input
              type="text"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
            />
            {selectedCase === "Case3" && ( // เพิ่มช่องสำหรับ num_lines เมื่อเลือก Case3
              <div>
                <label>num_lines: </label>
                <input
                  type="text"
                  value={numLines}
                  onChange={(e) => setNumLines(e.target.value)}
                />
              </div>
            )}
            <button onClick={handleGenerate}>Generate</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <img src={finalImageSrc} alt="Generated" style={{ width: "50%" }} />
          <button onClick={handleGenerateAgain}>Generate Again</button>
          <button onClick={handleExit}>Exit</button>
        </div>
      )}
    </div>
  );
}

export default MainApp;
