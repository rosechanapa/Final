import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const ScoreChart = ({ subjectId, section = "" }) => {
  const [distribution, setDistribution] = useState(null);

  useEffect(() => {
    if (subjectId) fetchScoreData();
  }, [subjectId, section]);

  const fetchScoreData = async () => {
    try {
      const url = section
        ? `http://127.0.0.1:5000/get_score_chart?subject_id=${subjectId}&section=${section}`
        : `http://127.0.0.1:5000/get_score_chart?subject_id=${subjectId}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        const distribution = data.distribution;

        // แปลง object เป็น array แล้วเรียง
        const sortedScores = Object.keys(distribution)
          .map(Number)
          .sort((a, b) => a - b);
        const counts = sortedScores.map((score) => distribution[score]);

        setDistribution({ scores: sortedScores, counts });
      } else {
        console.error("Error:", data.message);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  if (!distribution) return <div>Loading Score Distribution...</div>;

  const chartData = {
    labels: distribution.scores,
    datasets: [
      {
        label: "จำนวนนักศึกษา",
        data: distribution.counts,
        backgroundColor: "#68a5ec",
      },
    ],
  };

  return (
    <div>
      <h2 className="table-summarize-headtext">
        กราฟแสดงการวิเคราะห์คะแนนนักศึกษา{" "}
        {section ? `Section ${section}` : "ทุก Section"}
      </h2>
      <Bar
        data={chartData}
        options={{
          responsive: true,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: {
              title: { display: true, text: "คะแนน" },
              ticks: { font: { size: 12 } },
            },
            y: {
              title: { display: true, text: "จำนวนนักศึกษา" },
              ticks: {
                font: { size: 12 },
                beginAtZero: true,
                precision: 0,
                stepSize: 1, // จำนวนเต็ม
              },
            },
          },
        }}
      />
    </div>
  );
};

export default ScoreChart;