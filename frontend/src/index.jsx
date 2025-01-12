import React from "react";
import ReactDOM from "react-dom/client";
import "../src/index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

// 1) import socket ที่คุณสร้างไว้
import { socket } from "./socket";

// 2) ทดสอบการเชื่อมต่อ
socket.on("connect", () => {
  console.log("Connected to socket server from index.jsx:", socket.id);
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
