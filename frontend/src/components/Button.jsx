import React from "react";
import styled from "styled-components";

const ButtonComponent = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  vertical-align: middle;
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
  user-select: none;
  border-radius: 8px;
  padding: 0
    ${(props) =>
      props.size === "sm"
        ? "3rem"
        : props.size === "md"
        ? "6rem"
        : props.size === "lg"
        ? "10rem"
        : "6rem"};
  height: ${(props) =>
    props.size === "sm"
      ? "40px"
      : props.size === "md"
      ? "50px"
      : props.size === "lg"
      ? "70px"
      : "50px"};

  font-size: ${(props) =>
    props.size === "sm"
      ? "14px"
      : props.size === "md"
      ? "16px"
      : props.size === "lg"
      ? "20px"
      : "16px"};

  font-family: "Sarabun", sans-serif;
  font-weight: 550;
  color: ${(props) => (props.disabled ? "#888" : "#0a4682")};
  border: ${(props) => (props.disabled ? "none" : "1px solid #c5def8")};
  background-color: ${(props) =>
    props.disabled
      ? "#e0e0e0"
      : props.variant === "light"
      ? "#edf6ff"
      : props.variant === "primary"
      ? "#cfe5ff"
      : "#edf6ff"};

  &:hover {
    background-color: ${(props) =>
      props.disabled
        ? "#e0e0e0"
        : props.variant === "light"
        ? "#e7f4ff"
        : props.variant === "primary"
        ? "#bedbff"
        : "#e1f0ff"};
    color: ${(props) =>
      props.disabled ? "#888" : props.variant === "primary" ? "#042e5f" : "#3d79fd"};
  }
`;

const Button = ({
  type = "button", // ตั้งค่าดีฟอลต์ให้ type
  variant = "light", // ตั้งค่าดีฟอลต์ให้ variant
  className = "", // ตั้งค่าดีฟอลต์ให้ className
  size = "md", // ตั้งค่าดีฟอลต์ให้ size
  id,
  onClick,
  disabled,
  children,
}) => {
  return (
    <ButtonComponent
      type={type}
      variant={variant}
      className={`btn-component ${className}`}
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
