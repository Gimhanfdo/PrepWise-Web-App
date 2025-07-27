import pdfParse from "pdf-parse";
import {
  getSimilarityScore,
  getImprovementSuggestions,
} from "../utils/huggingface.js";
import CVAnalysis from "../models/CVAnalysisModel.js";
import SavedCVAnalysis from "../models/SavedCVAnalysisModel.js";

import OpenAI from "openai";

// Initialize the OpenAI instance
const AI = new OpenAI({ //
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

//Function to convert markdown-style formatting to basic HTML
function convertMarkdownToHTML(text) { //
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n\n/g, "<br/><br/>").replace(/\n/g, "<br/>");
}

// Controller to analyze a resume against multiple job descriptions
export const analyzeResume = async (req, res) => {
  try {
    console.log("Received resume:", req.file?.originalname);
    console.log("Received job descriptions:", req.body.jobDescriptions);

    const resumeFile = req.file;

    const rawJobDescriptions = JSON.parse(req.body.jobDescriptions);
    // Convert each job description to HTML for display purposes
    const jobDescriptions = rawJobDescriptions.map(jd => convertMarkdownToHTML(jd));

    if (!resumeFile || jobDescriptions.length === 0) {
      return res
        .status(400)
        .json({ message: "Resume or job descriptions missing." });
    }

    // Extract text from PDF
    const resumeText = (await pdfParse(resumeFile.buffer)).text;

    const analysis = [];

    for (let jd of jobDescriptions) {
      let similarity = 0;
      let suggestions = "No suggestions available";

      // Try to calculate similarity score between resume and job description
      try {
        similarity = await getSimilarityScore(resumeText, jd);
      } catch (e) {
        console.error("Similarity error:", e?.response?.data || e.message);
      }

      // Try to generate improvement suggestionS
      try {
        suggestions = await getImprovementSuggestions(resumeText, jd, AI); //
        // Format for display
        suggestions = convertMarkdownToHTML(suggestions); 
      } catch (e) {
        console.error("Suggestions error:", e?.response?.data || e.message);
      }

      // Push result into analysis array
      analysis.push({
        matchPercentage: Math.round(similarity * 100),
        suggestions,
      });
    }

    // Save the full analysis to the database
    await CVAnalysis.create({
      userId: req.user.id,
      resumeText,
      jobDescriptions,
      results: analysis,
    });

    // Return the analysis results to the frontend
    res.json({ analysis });
  } catch (err) {
    console.error("Error in analyzeResume:", err);
    res.status(500).json({ message: "Failed to analyze resume." });
  }
};

// Controller to save a completed analysis by a user
export const saveAnalysis = async (req, res) => {
  try {
    let { resumeName, jobDescriptions, results } = req.body;
    // Format job descriptions to HTML
    jobDescriptions = jobDescriptions.map(jd => convertMarkdownToHTML(jd));

    if (!resumeName || !jobDescriptions || !results) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Save the analysis in the database
    await SavedCVAnalysis.create({
      userId: req.user.id,
      resumeText: resumeName, 
      jobDescriptions,
      results,
    });

    res.json({ success: true, message: "Analysis saved." });
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ message: "Server error while saving analysis." });
  }
};

// Controller to fetch all saved analyses for the logged-in user
export const getSavedAnalysis = async (req, res) => {
  try {
    const savedAnalyses = await SavedCVAnalysis.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ savedAnalyses });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch saved analyses." });
  }
};

// Controller to delete a specific saved analysis
export const deleteAnalysis = async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete the analysis if it belongs to the logged-in user
    const deleted = await SavedCVAnalysis.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Analysis not found." });
    }

    res.json({ success: true, message: "Analysis deleted." });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Server error while deleting analysis." });
  }
};
