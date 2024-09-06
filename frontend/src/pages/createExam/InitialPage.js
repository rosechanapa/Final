import React, { useState } from 'react';

function InitialPage({ onSubmit }) {
  const [subjectId, setSubjectId] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [startNumber, setStartNumber] = useState('');


  const handleSubmit = async (event) => {
    event.preventDefault();

    const response = await fetch('http://127.0.0.1:5000/create_paper', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subject_id: subjectId, page_number: pageNumber, start_number: startNumber }),
    });

    if (response.ok) {
      const data = await response.json();
      const imageSrc = `data:image/png;base64,${data.image}`;
      onSubmit(subjectId, pageNumber, startNumber, imageSrc); // ส่งภาพ A กลับไปด้วย
    } else {
      console.error('Failed to create paper');
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Subject ID: </label>
          <input
            type="text"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          />
        </div>
        <div>
          <label>Page Number: </label>
          <input
            type="text"
            value={pageNumber}
            onChange={(e) => setPageNumber(e.target.value)}
          />
        </div>
        <div>
          <label>Start Number: </label>
          <input
            type="text"
            value={startNumber}
            onChange={(e) => setStartNumber(e.target.value)}
          />
        </div>
        <button type="submit">Next</button>
      </form>
    </div>
  );
}

export default InitialPage;