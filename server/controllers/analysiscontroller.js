import pdfParse from "pdf-parse";
import {
  getSimilarityScore,
  getImprovementSuggestions,
} from "../utils/huggingface.js";
import CVAnalysis from "../models/CVAnalysisModel.js";

import OpenAI from "openai";

const AI = new OpenAI({ //
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

function convertMarkdownToHTML(text) { //
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

export const analyzeResume = async (req, res) => {
  try {
    console.log("Received resume:", req.file?.originalname);
    console.log("Received job descriptions:", req.body.jobDescriptions);

    const resumeFile = req.file;
    const jobDescriptions = JSON.parse(req.body.jobDescriptions);

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
