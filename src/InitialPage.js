import React, { useState } from 'react';

function InitialPage({ onSubmit }) {
  const [subjectId, setSubjectId] = useState('');
  const [pageNumber, setPageNumber] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(subjectId, pageNumber);
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
        <button type="submit">Next</button>
      </form>
    </div>
  );
}

export default InitialPage;
