import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";

const BellCurve = ({ subjectId, section }) => {
  const [bellCurveData, setBellCurveData] = useState(null);

  // ฟังก์ชันดึงข้อมูล Bell Curve
  const fetchBellCurveData = async (subjectId, section) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/get_bell_curve?subject_id=${subjectId}&section=${section}`
      );
      const data = await response.json();
      if (data.success) {
        const { mean, sd, totals } = data;

        // คำนวณค่าความน่าจะเป็น (Probability Density)
        const scores = Array.from(
          { length: 100 },
          (_, i) => mean - 4 * sd + (i * 8 * sd) / 99
        ); // กระจายคะแนนในช่วง [mean - 4*SD, mean + 4*SD]
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
    if (subjectId && section) {
      fetchBellCurveData(subjectId, section);
    }
  }, [subjectId, section]);

  if (!bellCurveData) {
    return <div>Loading Bell Curve...</div>;
  }

  // เตรียมข้อมูลสำหรับ Bell Curve
  const chartData = {
    labels: bellCurveData.scores,
    datasets: [
      {
        label: "Probability Density",
        data: bellCurveData.density,
        borderColor: "rgba(75, 192, 192, 1)",
        fill: false,
      },
    ],
  };

  return (
    <div>
      <h3>Bell Curve (Normal Distribution)</h3>
      <Line
        data={chartData}
        options={{
          responsive: true,
          plugins: {
            legend: { display: true, position: "top" },
          },
          scales: {
            x: { title: { display: true, text: "Scores" } },
            y: {
              title: { display: true, text: "Probability Density" },
              beginAtZero: true,
            },
          },
        }}
      />
    </div>
  );
};

export default BellCurve;
