import React from "react";
import NavBar from "../components/NavBar";
import { Link } from "react-router-dom";
import { FaRobot, FaFileAlt, FaBullhorn, FaChartBar } from "react-icons/fa";

const FresherDashboard = () => {
  const cards = [
    {
      title: "CV Analyzer",
      description: "Get instant feedback on your resume and tailor it to job descriptions",
      icon: <FaFileAlt size={28} />,
      to: "/cv-analyzer",
      bg: "from-indigo-500 to-indigo-700",
    },
    {
      title: "Strengths and Weaknesses Analysis",
      description: "Analyze your strengths and weaknesses to get to know yourself better",
      icon: <FaChartBar size={28} />,
      to: "/swot",
      bg: "from-yellow-500 to-yellow-700",
    },
    {
      title: "Interview Bot",
      description: "Practice with AI-powered personalized interviews to boost your confidence",
      icon: <FaRobot size={28} />,
      to: "/interview-bot",
      bg: "from-pink-500 to-pink-700",
    },
        {
      title: "Notices",
      description: "Stay updated with job interview tips, workshops and webinars etc.",
      icon: <FaBullhorn size={28} />,
      to: "/notices",
      bg: "from-green-500 to-green-700",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 mt-2">Fresher Dashboard</h1>
        <p className="text-gray-600 mb-10 text-sm">
          Access tools and resources tailored to your job preparation journey.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, idx) => (
            <Link to={card.to} key={idx}>
              <div
                className={`rounded-xl p-6 h-60 shadow-md text-white bg-gradient-to-br ${card.bg} hover:scale-105 transition-transform duration-300 cursor-pointer`}
              >
                <div className="mb-4">{card.icon}</div>
                <h3 className="text-xl font-semibold">{card.title}</h3>
                <br />
                <p className="text-base text-gray-100">{card.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FresherDashboard;
