import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Chart, registerables } from "chart.js";
import { Empty } from "antd";

Chart.register(...registerables);

const ScoreChart = ({ subjectId, section = "" }) => {
  const [distribution, setDistribution] = useState(null);

  useEffect(() => {
    if (subjectId) fetchScoreData();
  }, [subjectId, section]);

  const fetchScoreData = async () => {
    try {
      const scoreUrl = section
        ? `http://127.0.0.1:5000/get_score_chart?subject_id=${subjectId}&section=${section}`
        : `http://127.0.0.1:5000/get_score_chart?subject_id=${subjectId}`;

      const totalScoreUrl = `http://127.0.0.1:5000/get_total_score?subject_id=${subjectId}`;

      const [scoreRes, totalRes] = await Promise.all([
        fetch(scoreUrl),
        fetch(totalScoreUrl),
      ]);

      const scoreData = await scoreRes.json();
      const totalData = await totalRes.json();

      if (scoreData.success && totalData.success) {
        const distribution = scoreData.distribution;
        const totalScore = Math.round(totalData.total_score); // สมมติเป็น int

        const allScores = Array.from({ length: totalScore + 1 }, (_, i) => i);
        const counts = allScores.map((score) => distribution[score] || 0);

        setDistribution({ scores: allScores, counts });
      } else {
        console.error("Error:", scoreData.message || totalData.message);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  useEffect(() => {
    setDistribution(null);
    if (subjectId) fetchScoreData();
  }, [subjectId, section]);

  if (!distribution)
    return (
      <div>
        <div
          className="table-summarize-text"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          ไม่สามารถแสดงกราฟการวิเคราะห์คะแนนนักศึกษาได้
        </div>
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            minHeight: "300px",
          }}
        >
          <Empty />
        </div>
      </div>
    );

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
              title: {
                display: true,
                text: "คะแนน",
                font: {
                  size: 12,
                },
              },
              ticks: {
                font: { size: 7 },
                stepSize: 1,
                autoSkip: false,
                minRotation: 90, // ✅ หมุนแนวตั้ง
                maxRotation: 90, // ✅ หมุนแนวตั้ง
                callback: function (val) {
                  return val;
                },
              },
            },
            y: {
              title: {
                display: true,
                text: "จำนวนนักศึกษา",
                font: {
                  size: 12,
                },
              },

              ticks: {
                font: { size: 9 },
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