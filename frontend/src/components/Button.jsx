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
        ? "2.3rem"
        : props.size === "md"
        ? "6rem"
        : props.size === "lg"
        ? "10rem"
        : props.size === "edit"
        ? "1rem"
        : props.size === "custom"
        ? "4rem"
        : props.size === "view-btt"
        ? "2rem"
        : "6rem"};
  height: ${(props) =>
    props.size === "sm"
      ? "43px"
      : props.size === "md"
      ? "50px"
      : props.size === "lg"
      ? "70px"
      : props.size === "edit"
      ? "40px"
      : props.size === "custom"
      ? "50px"
      : props.size === "view-btt"
      ? "45px"
      : "50px"};

  font-size: ${(props) =>
    props.size === "sm"
      ? "14px"
      : props.size === "md"
      ? "16px"
      : props.size === "lg"
      ? "20px"
      : props.size === "edit"
      ? "10px"
      : props.size === "custom"
      ? "16px"
      : props.size === "view-btt"
      ? "15px"
      : "16px"};

  font-family: "Sarabun", sans-serif;
  font-weight: 550;
  color: ${(props) =>
    props.disabled
      ? "#888"
      : props.variant === "danger"
      ? "#ff4d4f"
      : props.variant === "light-disabled"
      ? "#9ab0c4"
      : "#0a4682"};
  border: ${(props) =>
    props.disabled
      ? "none"
      : props.variant === "danger"
      ? "1px solid #ffd7d8"
      : props.variant === "light-disabled"
      ? "1px solid #ddecfc"
      : "1px solid #c5def8"};
  background-color: ${(props) =>
    props.disabled
      ? "#e0e0e0"
      : props.variant === "light"
      ? "#e9f3fe"
      : props.variant === "primary"
      ? "#cfe5ff"
      : props.variant === "light-disabled"
      ? "#eaf3fa"
      : props.variant === "danger"
      ? "#ffe1e1"
      : props.variant === "export"
      ? "#d1dbe8"
      : "#edf6ff"};

  &:hover {
    background-color: ${(props) =>
      props.disabled
        ? "#e0e0e0" // ไม่เปลี่ยนแปลงสีพื้นหลังเมื่อปุ่มถูกปิดการทำงาน
        : props.variant === "light"
        ? "#e7f4ff"
        : props.variant === "primary"
        ? "#bedbff"
        : props.variant === "light-disabled"
        ? "#eaf3fa"
        : props.variant === "danger"
        ? "#fed8d8"
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
        : "#3d79fd"};
  }
`;

const Button = ({
  type,
  variant,
  className,
  size,
  id,
  onClick,
  disabled,
  children,
}) => {
  return (
    <ButtonComponent
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
};

export default Button;
