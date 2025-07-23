import React from "react";
import NavBar from "../components/NavBar";
import { Link } from "react-router-dom";

const FresherDashboard = () => {
  return (
    <div>
      <NavBar />
      <div className="p-6">
        <Link to="/cv-analyzer">
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
            Go to CV Analyzer
          </button>
        </Link>
      </div>
    </div>
  );
};

export default FresherDashboard;
