import React, { useState } from 'react';
import InitialPage from './InitialPage';
import MainApp from './MainApp';

function App() {
  const [subjectId, setSubjectId] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInitialSubmit = (subjectId, pageNumber) => {
    setSubjectId(subjectId);
    setPageNumber(pageNumber);
    setIsSubmitted(true);
  };

  return (
    <div>
      {!isSubmitted ? (
        <InitialPage onSubmit={handleInitialSubmit} />
      ) : (
        <MainApp subjectId={subjectId} pageNumber={pageNumber} />
      )}
    </div>
  );
}

export default App;
