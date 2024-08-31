import React, { useState } from 'react';

function App() {
  const [step, setStep] = useState(1);
  const [selectedCase, setSelectedCase] = useState('');
  const [rangeInput, setRangeInput] = useState('');
  const [imageSrc, setImageSrc] = useState('');

  const handleCaseSelect = (selectedCase) => {
    setSelectedCase(selectedCase);
    setStep(2);
  };

  const handleGenerate = async () => {
    const response = await fetch('http://127.0.0.1:5000/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ selected_case: selectedCase, range_input: rangeInput }),
    });

    if (response.ok) {
      const data = await response.json();
      setImageSrc(`data:image/png;base64,${data.image}`);
      setStep(3);  // ไปยังขั้นตอนการแสดงภาพ
    } else {
      console.error('Failed to generate image');
    }
  };

  const handleExit = () => {
    setStep(1);
    setSelectedCase('');
    setRangeInput('');
    setImageSrc('');
  };

  return (
    <div>
      {step === 1 && (
        <div>
          <h1>Select case</h1>
          <button onClick={() => handleCaseSelect('Case1')}>Case1</button>
          <button onClick={() => handleCaseSelect('Case2')}>Case2</button>
          <button onClick={() => handleCaseSelect('Case3')}>Case3</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h1>Select case</h1>
          <button onClick={() => handleCaseSelect('Case1')}>Case1</button>
          <button onClick={() => handleCaseSelect('Case2')}>Case2</button>
          <button onClick={() => handleCaseSelect('Case3')}>Case3</button>
          <div>
            <label>range_input: </label>
            <input
              type="text"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
            />
            <button onClick={handleGenerate}>Generate</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <img src={imageSrc} alt="Generated" style={{ width: '50%' }} />
          <button onClick={() => setStep(1)}>Generate Again</button>
          <button onClick={handleExit}>Exit</button>
        </div>
      )}
    </div>
  );
}

export default App;
