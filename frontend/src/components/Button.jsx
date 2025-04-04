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
        : props.size === "action-upload"
        ? "1.5rem"
        : props.size === "btt-recheck"
        ? "12.5rem"
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
      : props.size === "action-upload"
      ? "36px"
      : props.size === "btt-recheck"
      ? "20px"
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
      : props.size === "action-upload"
      ? "12px"
      : props.size === "btt-recheck"
      ? "45px"
      : "16px"};

  font-family: "Sarabun", sans-serif;
  font-weight: 550;

  @media screen and (max-width: 1365px) {
    padding: 0
      ${(props) =>
        props.size === "sm"
          ? "3.5rem"
          : props.size === "md"
          ? "5.8rem"
          : props.size === "lg"
          ? "12rem"
          : props.size === "edit"
          ? "0.9rem"
          : props.size === "custom"
          ? "4rem"
          : props.size === "view-btt"
          ? "2rem"
          : props.size === "action-upload"
          ? "1.5rem"
          : props.size === "btt-recheck"
          ? "12.5rem"
          : "8rem"};

    height: ${(props) =>
      props.size === "sm"
        ? "45px"
        : props.size === "md"
        ? "48px"
        : props.size === "lg"
        ? "80px"
        : props.size === "edit"
        ? "38px"
        : props.size === "custom"
        ? "47px"
        : props.size === "view-btt"
        ? "37px"
        : props.size === "action-upload"
        ? "36px"
        : props.size === "btt-recheck"
        ? "42px"
        : "55px"};

    font-size: ${(props) =>
      props.size === "sm"
        ? "14px"
        : props.size === "md"
        ? "15px"
        : props.size === "lg"
        ? "22px"
        : props.size === "edit"
        ? "10px"
        : props.size === "custom"
        ? "14px"
        : props.size === "view-btt"
        ? "13px"
        : props.size === "action-upload"
        ? "12px"
        : props.size === "btt-recheck"
        ? "13px"
        : "18px"};
  }

  @media screen and (min-width: 1366px) and (max-width: 1440px) {
    padding: 0
      ${(props) =>
        props.size === "sm"
          ? "4rem"
          : props.size === "md"
          ? "6rem"
          : props.size === "lg"
          ? "12rem"
          : props.size === "edit"
          ? "0.8rem"
          : props.size === "custom"
          ? "4.2rem"
          : props.size === "view-btt"
          ? "2.2rem"
          : props.size === "action-upload"
          ? "1.8rem"
          : props.size === "btt-recheck"
          ? "12.8rem"
          : "8rem"};

    height: ${(props) =>
      props.size === "sm"
        ? "50px"
        : props.size === "md"
        ? "52px"
        : props.size === "lg"
        ? "80px"
        : props.size === "edit"
        ? "40px"
        : props.size === "custom"
        ? "52px"
        : props.size === "view-btt"
        ? "40px"
        : props.size === "action-upload"
        ? "40px"
        : props.size === "btt-recheck"
        ? "45px"
        : "55px"};

    font-size: ${(props) =>
      props.size === "sm"
        ? "15px"
        : props.size === "md"
        ? "16px"
        : props.size === "lg"
        ? "22px"
        : props.size === "edit"
        ? "10px"
        : props.size === "custom"
        ? "15px"
        : props.size === "view-btt"
        ? "14px"
        : props.size === "action-upload"
        ? "13px"
        : props.size === "btt-recheck"
        ? "15px"
        : "18px"};
  }

  @media screen and (min-width: 1441px) {
    padding: 0
      ${(props) =>
        props.size === "sm"
          ? "4rem"
          : props.size === "md"
          ? "6rem"
          : props.size === "lg"
          ? "12rem"
          : props.size === "edit"
          ? "0.9rem"
          : props.size === "custom"
          ? "4.3rem"
          : props.size === "view-btt"
          ? "2.4rem"
          : props.size === "action-upload"
          ? "2.3rem"
          : props.size === "btt-recheck"
          ? "13.5rem"
          : "8rem"};

    height: ${(props) =>
      props.size === "sm"
        ? "54px"
        : props.size === "md"
        ? "60px"
        : props.size === "lg"
        ? "80px"
        : props.size === "edit"
        ? "45px"
        : props.size === "custom"
        ? "54px"
        : props.size === "view-btt"
        ? "46px"
        : props.size === "action-upload"
        ? "45px"
        : props.size === "btt-recheck"
        ? "50px"
        : "55px"};

    font-size: ${(props) =>
      props.size === "sm"
        ? "16px"
        : props.size === "md"
        ? "18px"
        : props.size === "lg"
        ? "22px"
        : props.size === "edit"
        ? "10px"
        : props.size === "custom"
        ? "16px"
        : props.size === "view-btt"
        ? "15px"
        : props.size === "action-upload"
        ? "15px"
        : props.size === "btt-recheck"
        ? "17px"
        : "18px"};
  }

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