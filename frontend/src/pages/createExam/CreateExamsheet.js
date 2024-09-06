import React, { useState } from "react";
import InitialPage from "./InitialPage";
import MainApp from "./MainApp";

function CreateExamsheet() {
  const [subjectId, setSubjectId] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [imageSrc, setImageSrc] = useState(""); // เพิ่ม state สำหรับเก็บภาพ A

  const handleInitialSubmit = (subjectId, pageNumber, image) => {
    setSubjectId(subjectId);
    setPageNumber(pageNumber);
    setImageSrc(image); // เก็บภาพ A ที่ได้จากการสร้าง
    setIsSubmitted(true);
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setSubjectId("");
    setPageNumber("");
    setImageSrc(""); // ล้างค่า imageSrc
  };

  return (
    <div>
      {!isSubmitted ? (
        <InitialPage onSubmit={handleInitialSubmit} />
      ) : (
        <MainApp
          subjectId={subjectId}
          pageNumber={pageNumber}
          imageSrc={imageSrc}
          onReset={handleReset} // ส่งฟังก์ชัน reset เพื่อใช้ตอนกด Generate Again หรือ Exit
        />
      )}
    </div>
  );
}

export default CreateExamsheet;
