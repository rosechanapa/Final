import React from "react";
import styled from "styled-components";

const ButtonComponent = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  text-decoration: none;
  vertical-align: middle;
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
  user-select: none;
  border-radius: 8px;
  padding: 0
    ${(props) =>
      props.size === "sm"
        ? "2rem"
        : props.size === "md"
        ? "4.5rem"
        : props.size === "lg"
        ? "10rem"
        : props.size === "edit"
        ? "0.5rem"
        : props.size === "custom"
        ? "3.3rem"
        : props.size === "view-btt"
        ? "1.3rem"
        : "6rem"};
  height: ${(props) =>
    props.size === "sm"
      ? "38px"
      : props.size === "md"
      ? "46px"
      : props.size === "lg"
      ? "70px"
      : props.size === "edit"
      ? "35px"
      : props.size === "custom"
      ? "45px"
      : props.size === "view-btt"
      ? "38px"
      : "50px"};

  font-size: ${(props) =>
    props.size === "sm"
      ? "12px"
      : props.size === "md"
      ? "14px"
      : props.size === "lg"
      ? "20px"
      : props.size === "edit"
      ? "8px"
      : props.size === "custom"
      ? "13px"
      : props.size === "view-btt"
      ? "12px"
      : "16px"};

  font-family: "Sarabun", sans-serif;
  font-weight: 550;
  color: ${(props) =>
    props.disabled
      ? "#888"
      : props.variant === "danger"
      ? "#ff4d4f"
      : props.variant === "light-cus"
      ? "#3d6593"
      : props.variant === "light-disabled"
      ? "#9ab0c4"
      : props.variant === "Free"
      ? "#359753"
      : "#0a4682"};
  border: ${(props) =>
    props.disabled
      ? "none"
      : props.variant === "danger"
      ? "1px solid #ffd7d8"
      : props.variant === "light-disabled"
      ? "1px solid #ddecfc"
      : props.variant === "light-cus"
      ? "1px solid #bedaf8"
      : props.variant === "Free"
      ? "#aed9bb"
      : "1px solid #c5def8"};
  background-color: ${(props) =>
    props.disabled
      ? "#e0e0e0"
      : props.variant === "light"
      ? "#e9f3fe"
      : props.variant === "light-cus"
      ? "#e0effc"
      : props.variant === "primary"
      ? "#cfe5ff"
      : props.variant === "light-disabled"
      ? "#eaf3fa"
      : props.variant === "danger"
      ? "#ffe1e1"
      : props.variant === "export"
      ? "#d1dbe8"
      : props.variant === "Free"
      ? "#d2f1db"
      : "#edf6ff"};

  &:hover {
    background-color: ${(props) =>
      props.disabled
        ? "#e0e0e0" // ไม่เปลี่ยนแปลงสีพื้นหลังเมื่อปุ่มถูกปิดการทำงาน
        : props.variant === "light"
        ? "#e7f4ff"
        : props.variant === "light-cus"
        ? "#d7ecfc"
        : props.variant === "primary"
        ? "#bedbff"
        : props.variant === "light-disabled"
        ? "#eaf3fa"
        : props.variant === "danger"
        ? "#fed8d8"
        : props.variant === "Free"
        ? "#c1e2ca"
        : "#e1f0ff"};
    color: ${(props) =>
      props.disabled
        ? "#888"
        : props.variant === "primary"
        ? "#042e5f"
        : props.variant === "light-disabled"
        ? "#9ab0c4"
        : props.variant === "danger"
        ? "#ed393c"
        : props.variant === "Free"
        ? "#359753"
        : "#3d79fd"};
  }
`;

const Button = React.forwardRef(
  (
    { type, variant, className, size, id, onClick, disabled, children },
    ref
  ) => {
    return (
      <ButtonComponent
        ref={ref}
        type={type ? type : "button"}
        variant={variant}
        className={className ? `btn-component ${className}` : "btn-component"}
        id={id}
        size={size}
        onClick={!disabled ? onClick : null}
        disabled={disabled}
      >
        {children}
      </ButtonComponent>
    );
  }
);

export default Button;