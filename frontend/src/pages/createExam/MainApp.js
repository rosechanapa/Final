import React, { useState } from 'react';

function MainApp({ subjectId, pageNumber, imageSrc, onReset }) {
  const [step, setStep] = useState(1);
  const [selectedCase, setSelectedCase] = useState('');
  const [rangeInput, setRangeInput] = useState('');
  const [numLines, setNumLines] = useState('');
  const [finalImageSrc, setFinalImageSrc] = useState(imageSrc);
  const [typeInput, setTypeInput] = useState('');  

  const handleCaseSelect = (event) => {
    setSelectedCase(event.target.value);
    setRangeInput('');
    setNumLines('');
    setTypeInput('');
  };

  const handleGenerate = async () => {
    const response = await fetch('http://127.0.0.1:5000/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        selected_case: selectedCase,
        range_input: rangeInput,
        num_lines: numLines,
        type_input: typeInput,  
      }),
    });
  
    if (response.ok) {
      const data = await response.json();
      setFinalImageSrc(`data:image/png;base64,${data.image}`);
  
      if (data.status === "Reached max height") {
        alert("เพิ่มสูงสุดได้เท่านี้!"); // แสดง pop-up แจ้งเตือน
      }
  
      setStep(2);
    } else {
      console.error('Failed to generate image');
    }
  };

  const handleExit = async () => {
    await fetch('http://127.0.0.1:5000/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    onReset();
  };

  const handleGenerateAgain = async () => {
    setSelectedCase('');
    setRangeInput('');
    setNumLines('');
    setTypeInput(''); 
    setStep(1);
  };

  return (
    <div>
      {step === 1 && (
        <div>
          <h1>Select case and range</h1>
          <div>
            <label>Case: </label>
            <select value={selectedCase} onChange={handleCaseSelect}>
              <option value="">Select Case</option>
              <option value="Case1">Case1</option>
              <option value="Case2">Case2</option>
              <option value="Case3">Case3</option>
              <option value="Case4">Case4</option>
            </select>
          </div>
          <div>
            <label>Range Input: </label>
            <input
              type="text"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
            />
          </div>
          {selectedCase === 'Case1' && (
            <div>
              <label>Type: </label>
              <select
                value={typeInput}
                onChange={(e) => setTypeInput(e.target.value)}
              >
                <option value="">Select Type</option>
                <option value="number">Number</option>
                <option value="character">Character</option>
              </select>
            </div>
          )}
          {selectedCase === 'Case3' && (
            <div>
              <label>Number of Lines: </label>
              <input
                type="text"
                value={numLines}
                onChange={(e) => setNumLines(e.target.value)}
              />
            </div>
          )}
          <button onClick={handleGenerate}>Generate</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <img src={finalImageSrc} alt="Generated" style={{ width: '50%' }} />
          <button onClick={handleGenerateAgain}>Generate Again</button>
          <button onClick={handleExit}>Exit</button>
        </div>
      )}
    </div>
  );
}

export default MainApp;