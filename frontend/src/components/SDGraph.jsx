import React, { useState, useEffect } from "react";
import { Bar } from "react-chartjs-2"; // ใช้ Bar Chart จาก react-chartjs-2
import "chart.js/auto"; // ทำให้ Chart.js ทำงานอัตโนมัติ

const SDGraph = ({ subjectId }) => {
  const [sdScore, setSDScore] = useState({});
  const [chartData, setChartData] = useState(null);

  // ฟังก์ชันดึงข้อมูล SD
  const fetchSDScore = async (subjectId) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/get_sd?subject_id=${subjectId}`
      );
      const data = await response.json();
      if (data.success) {
        setSDScore(data.sd_per_section); // บันทึกค่า SD ต่อ Section
      } else {
        console.error("Failed to fetch SD data:", data.message);
      }
    } catch (error) {
      console.error("Error fetching SD data:", error);
    }
  };

  // สร้าง Chart Data เมื่อมีข้อมูล SD
  useEffect(() => {
    console.log("SD Score State:", sdScore); // ตรวจสอบข้อมูล SD
    if (Object.keys(sdScore).length > 0) {
      const labels = Object.keys(sdScore); // ชื่อ Section
      const data = Object.values(sdScore); // ค่า SD ต่อ Section

      console.log("Labels:", labels); // ตรวจสอบ Labels
      console.log("Data:", data); // ตรวจสอบค่า SD

      setChartData({
        labels: labels,
        datasets: [
          {
            label: "Standard Deviation (SD)",
            data: data,
            backgroundColor: "rgba(75, 192, 192, 0.5)", // สีแท่ง
            borderColor: "rgba(75, 192, 192, 1)", // สีขอบ
            borderWidth: 1,
          },
        ],
      });
    }
  }, [sdScore]);

  // เรียกข้อมูลเมื่อ subjectId เปลี่ยน
  useEffect(() => {
    if (subjectId) {
      console.log("Fetching SD for Subject ID:", subjectId);
      fetchSDScore(subjectId);
    }
  }, [subjectId]);

  // หากไม่มีข้อมูล ให้แสดง Loading
  if (!chartData) {
    console.log("Chart Data is not ready yet");
    return <div>Loading...</div>;
  }

  // แสดงกราฟ Bar Chart
  return (
    <div>
      <h3>SD Graph (Standard Deviation)</h3>
      <Bar
        data={chartData}
        options={{
          responsive: true,
          plugins: {
            legend: {
              display: true,
              position: "top",
            },
          },
          scales: {
            x: {
              title: {
                display: true,
                text: "Sections",
              },
            },
            y: {
              title: {
                display: true,
                text: "Standard Deviation (SD)",
              },
              beginAtZero: true,
            },
          },
        }}
      />
    </div>
  );
};

export default SDGraph;
