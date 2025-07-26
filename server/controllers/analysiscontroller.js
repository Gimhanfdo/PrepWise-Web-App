import pdfParse from "pdf-parse";
import {
  getSimilarityScore,
  getImprovementSuggestions,
} from "../utils/huggingface.js";
import CVAnalysis from "../models/CVAnalysisModel.js";
import SavedCVAnalysis from "../models/SavedCVAnalysisModel.js";

import OpenAI from "openai";

const AI = new OpenAI({ //
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

function convertMarkdownToHTML(text) { //
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n\n/g, "<br/><br/>").replace(/\n/g, "<br/>");
}

export const analyzeResume = async (req, res) => {
  try {
    console.log("Received resume:", req.file?.originalname);
    console.log("Received job descriptions:", req.body.jobDescriptions);

    const resumeFile = req.file;

    const rawJobDescriptions = JSON.parse(req.body.jobDescriptions);
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

      try {
        similarity = await getSimilarityScore(resumeText, jd);
      } catch (e) {
        console.error("Similarity error:", e?.response?.data || e.message);
      }

      try {
        suggestions = await getImprovementSuggestions(resumeText, jd, AI); //
        suggestions = convertMarkdownToHTML(suggestions); 
      } catch (e) {
        console.error("Suggestions error:", e?.response?.data || e.message);
      }

      analysis.push({
        matchPercentage: Math.round(similarity * 100),
        suggestions,
      });
    }

    await CVAnalysis.create({
      userId: req.user.id,
      resumeText,
      jobDescriptions,
      results: analysis,
    });

    res.json({ analysis });
  } catch (err) {
    console.error("Error in analyzeResume:", err);
    res.status(500).json({ message: "Failed to analyze resume." });
  }
};


export const saveAnalysis = async (req, res) => {
  try {
    let { resumeName, jobDescriptions, results } = req.body;
    jobDescriptions = jobDescriptions.map(jd => convertMarkdownToHTML(jd));

    if (!resumeName || !jobDescriptions || !results) {
      return res.status(400).json({ message: "Missing required fields." });
    }

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

export const getSavedAnalysis = async (req, res) => {
  try {
    const savedAnalyses = await SavedCVAnalysis.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ savedAnalyses });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch saved analyses." });
  }
};

export const deleteAnalysis = async (req, res) => {
  try {
    const { id } = req.params;

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
