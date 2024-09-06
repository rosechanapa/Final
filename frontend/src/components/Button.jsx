import React from "react";

const Button = ({ type, variant, className, id, onClick, children }) => {
  return (
    <button
      type={type ? type : "button"}
      variant={variant}
      className={className ? `btn-component ${className}` : "btn-component"}
      id={id}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
export default Button;
