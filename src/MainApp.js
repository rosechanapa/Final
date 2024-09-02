import React, { useState } from 'react';

function MainApp({ subjectId, pageNumber, imageSrc, onReset }) {
  const [step, setStep] = useState(1);
  const [selectedCase, setSelectedCase] = useState('');
  const [rangeInput, setRangeInput] = useState('');
  const [numLines, setNumLines] = useState('');
  const [finalImageSrc, setFinalImageSrc] = useState(imageSrc);
  const [typeInput, setTypeInput] = useState('');  

  const handleCaseSelect = (selectedCase) => { // ล้างค่าเลือกเคสใหม่
    setSelectedCase(selectedCase);
    setRangeInput('');
    setNumLines('');
    setTypeInput('');
    setStep(2);
  };

  const handleGenerate = async () => { // ส่งค่าไป app.py
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
      setStep(3);
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

  const handleGenerateAgain = async () => { // ล้างค่าเมื่อเริ่มใหม่
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
          <h1>Select case</h1>
          <button onClick={() => handleCaseSelect('Case1')}>Case1</button>
          <button onClick={() => handleCaseSelect('Case2')}>Case2</button>
          <button onClick={() => handleCaseSelect('Case3')}>Case3</button>
          <button onClick={() => handleCaseSelect('Case4')}>Case3</button>
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
          <img src={finalImageSrc} alt="Generated" style={{ width: '50%' }} />
          <button onClick={handleGenerateAgain}>Generate Again</button>
          <button onClick={handleExit}>Exit</button>
        </div>
      )}
    </div>
  );
}

export default MainApp;
