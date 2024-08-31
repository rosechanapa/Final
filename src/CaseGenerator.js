import React, { useState } from 'react';

function CaseGenerator({ subjectId, pageNumber }) {
  const [caseNumber, setCaseNumber] = useState(null);
  const [rangeInput, setRangeInput] = useState('');
  const [imageSrc, setImageSrc] = useState('');
  const [isExit, setIsExit] = useState(false);

  const cases = ['1', '2', '3'];

  const handleGenerate = async () => {
    // แสดงข้อมูลที่กำลังจะส่งไปยัง backend ใน console
    console.log({ case: caseNumber, range_input: rangeInput });

    try {
        const response = await fetch('http://127.0.0.1:5000/draw', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ case: caseNumber, range_input: rangeInput }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setImageSrc(data.image_path); 
    } catch (error) {
        console.error('Failed to generate image:', error);
    }
  };




  const handleExit = () => {
    setIsExit(true);
    setCaseNumber(null);
    setRangeInput('');
    setImageSrc('');
  };

  if (isExit) {
    return <div>Exited Loop. You can start a new session by refreshing the page.</div>;
  }

  return (
    <div>
      {imageSrc && (
        <>
          <img src={`http://127.0.0.1:5000/static/${imageSrc}`} alt="Generated" style={{ width: '50%' }} />
          <button onClick={handleExit}>Exit</button>
        </>
      )}

      {!imageSrc && (
        <>
          {!caseNumber ? (
            <div>
              <h3>Select a Case</h3>
              {cases.map((caseNum) => (
                <button key={caseNum} onClick={() => setCaseNumber(caseNum)}>
                  Case {caseNum}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <h3>Case {caseNumber}</h3>
              <label>Range Input: </label>
              <input
                type="text"
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
              />
              <button onClick={handleGenerate}>Generate</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CaseGenerator;
