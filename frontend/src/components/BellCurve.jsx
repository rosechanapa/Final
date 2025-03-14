import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import "../css/analyze.css";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);
const BellCurve = ({ subjectId, section = "" }) => {
  const [bellCurveData, setBellCurveData] = useState(null);
  // const [maxScore, setMaxScore] = useState(100);
  // ฟังก์ชันดึงข้อมูล Bell Curve
  useEffect(() => {
    if (subjectId) fetchBellCurveData();
  }, [subjectId, section]);

  useEffect(() => {
    console.log("Bell Curve Data:", bellCurveData);
  }, [bellCurveData]);

  const fetchBellCurveData = async () => {
    try {
      const url = section
        ? `http://127.0.0.1:5000/get_bell_curve?subject_id=${subjectId}&section=${section}`
        : `http://127.0.0.1:5000/get_bell_curve?subject_id=${subjectId}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        const { mean, sd } = data;

        const scores = Array.from({ length: 100 }, (_, i) => (i * 8 * sd) / 99);
        const density = scores.map(
          (x) =>
            (1 / (sd * Math.sqrt(2 * Math.PI))) *
            Math.exp(-0.5 * ((x - mean) / sd) ** 2)
        );

        setBellCurveData({ scores, density });
      } else {
        console.error("Failed to fetch Bell Curve data:", data.message);
      }
    } catch (error) {
      console.error("Error fetching Bell Curve data:", error);
    }
  };

  useEffect(() => {
    if (subjectId) fetchBellCurveData();
  }, [subjectId, section]);

  if (!bellCurveData) return <div>Loading Bell Curve...</div>;

  // เตรียมข้อมูลสำหรับ Bell Curve
  const chartData = {
    labels: bellCurveData.scores,
    datasets: [
      {
        label: section
          ? `Bell Curve for Section ${section}`
          : "Bell Curve for All Sections",
        data: bellCurveData.density,
        borderColor: "#55d5de",
        fill: false,
      },
    ],
  };

  return (
    <div>
      <h1 className="Head-bell-curve">
        {section
          ? `Bell Curve (Section ${section})`
          : "Bell Curve (All Sections)"}
      </h1>
      <Line
        data={chartData}
        options={{
          responsive: true,
          plugins: {
            legend: { display: true, position: "top" },
          },
          scales: {
            x: {
              title: { display: true, text: "Scores" },
              ticks: { font: { size: 12 } },
              min: 0,
            },
            y: {
              title: { display: true, text: "Probability Density" },
              ticks: { font: { size: 12 } },
              beginAtZero: true,
              min: 0,
            },
          },
        }}
      />
    </div>
  );
};

export default BellCurve;