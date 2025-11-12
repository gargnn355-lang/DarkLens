import React from 'react';

const Highlight = ({ text, term }) => {
  if (!term || !text) {
    return text;
  }

  const textString = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
  const regex = new RegExp(`(${term})`, 'gi');
  const parts = textString.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-indigo-500 text-white px-1">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

export default Highlight; 