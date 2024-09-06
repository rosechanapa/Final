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
  cursor: pointer;
  user-select: none;
  border-radius: 8px;
  padding: 0
    ${(props) =>
      props.size === "sm"
        ? "5rem"
        : props.size === "md"
        ? "8rem"
        : props.size === "lg"
        ? "10rem"
        : "6rem"};
  height: ${(props) =>
    props.size === "sm"
      ? "30px"
      : props.size === "md"
      ? "40px"
      : props.size === "lg"
      ? "50px"
      : "50px"};
  font-family: "Sarabun", sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: #1a4679;
  border: 1px solid transparent;
  background-color: ${(props) =>
    props.variant === "light"
      ? "#F2F8FF"
      : props.variant === "primary"
      ? "#bcd8f7"
      : props.variant === "disabled"
      ? "#D2D5D9"
      : "#f8f9fa"};
  &:hover {
    background-color: ${(props) =>
      props.variant === "light"
        ? "#D9E5F3"
        : props.variant === "primary"
        ? "#abccf4"
        : props.variant === "disabled"
        ? "#D2D5D9"
        : "#e0e0e0"};
    color: ${(props) => (props.variant === "primary" ? "#224a78" : "#000")};
  }
`;

const Button = ({ type, variant, className, id, onClick, children }) => {
  return (
    <ButtonComponent
      type={type ? type : "button"}
      variant={variant}
      className={className ? `btn-component ${className}` : "btn-component"}
      id={id}
      onClick={onClick}
    >
      {children}
    </ButtonComponent>
  );
};
export default Button;
