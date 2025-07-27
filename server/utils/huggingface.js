import axios from "axios";
import OpenAI from "openai";

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;

// Initialize OpenAI client using a Gemini-compatible endpoint
const AI = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

// Validation helper
const validateInputs = (text1, text2) => {
  // Check if either input is missing or not a string
  if (
    !text1 ||
    !text2 ||
    typeof text1 !== "string" ||
    typeof text2 !== "string"
  ) {
    throw new Error("Both inputs must be non-empty strings");
  }
  // Limit input length to avoid exceeding model token limits
  if (text1.length > 10000 || text2.length > 10000) {
    throw new Error("Input text too long (max 10,000 characters)");
  }
};

// 1. Primary Function: Get Similarity Score
export const getSimilarityScore = async (text1, text2) => {
  try {
    validateInputs(text1, text2);

    if (!HF_API_KEY) {
      throw new Error("HUGGINGFACE_API_KEY environment variable is not set");
    }

    // Use the Hugging Face inference API endpoint for sentence similarity
    const url =
      "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";

    // Set required headers for authentication and content type
    const headers = {
      Authorization: `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json",
    };

    // Create payload with source sentence and target sentence(s)
    const payload = {
      inputs: {
        source_sentence: text1,
        sentences: [text2],
      },
    };

    console.log(
      "Sending similarity request with payload:",
      JSON.stringify(payload, null, 2)
    );

    // Make POST request to Hugging Face API
    const response = await axios.post(url, payload, { headers });

    console.log("Similarity API response:", response.data);

    // The response should be an array with similarity scores
    if (Array.isArray(response.data) && response.data.length > 0) {
      const similarity = response.data[0];

      // Ensure the score is within [-1, 1] range
      return Math.max(-1, Math.min(1, similarity));
    }

    // Fallback: try alternative approach with embeddings
    return await getEmbeddingSimilarity(text1, text2);
  } catch (err) {
    console.error(
      "Error in getSimilarityScore:",
      err.response?.data || err.message
    );

    // Attempt fallback using custom embedding similarity logic
    try {
      return await getEmbeddingSimilarity(text1, text2);
    } catch (fallbackErr) {
      console.error("Fallback similarity also failed:", fallbackErr.message);

      // Handle specific API errors
      if (err.response?.status === 503) {
        throw new Error(
          "Model is currently loading. Please try again in a few minutes."
        );
      }
      if (err.response?.status === 401) {
        throw new Error("Invalid API key");
      }
      if (err.response?.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }

      throw new Error(`Failed to calculate similarity: ${err.message}`);
    }
  }
};

// Alternative embedding approach 
// Used as a backup if the sentence-pair similarity API fails
const getEmbeddingSimilarity = async (text1, text2) => {

  // Hugging Face model endpoint for generating sentence embeddings
  const url =
    "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";
  const headers = {
    Authorization: `Bearer ${HF_API_KEY}`,
    "Content-Type": "application/json",
  };

  // Step 1: Get embeddings for each text separately
  // Use Promise.all to send two parallel POST requests
  const [response1, response2] = await Promise.all([
    axios.post(url, { inputs: text1 }, { headers }),
    axios.post(url, { inputs: text2 }, { headers }),
  ]);

  console.log("Embedding responses:", {
    resp1: response1.data?.length || "invalid",
    resp2: response2.data?.length || "invalid",
  });

  let embedding1, embedding2;

  // Step 2: Extract Embeddings from Response
  // Handle different response formats
  if (Array.isArray(response1.data)) {
    embedding1 = response1.data;
  } else if (response1.data && Array.isArray(response1.data.embeddings)) {
    embedding1 = response1.data.embeddings[0];
  } else {
    throw new Error("Invalid embedding response format for text1");
  }

  if (Array.isArray(response2.data)) {
    embedding2 = response2.data;
  } else if (response2.data && Array.isArray(response2.data.embeddings)) {
    embedding2 = response2.data.embeddings[0];
  } else {
    throw new Error("Invalid embedding response format for text2");
  }

  // Step 3: Validate Embedding Vectors
  // Ensure both vectors are arrays of the same length
  if (
    !Array.isArray(embedding1) ||
    !Array.isArray(embedding2) ||
    embedding1.length !== embedding2.length
  ) {
    throw new Error("Invalid embedding vectors");
  }

  // Step 4: Cosine similarity calculation
  // Calculate dot product
  const dotProduct = embedding1.reduce(
    (sum, val, i) => sum + val * embedding2[i],
    0
  );
  // Calculate magnitudes (Euclidean norms)
  const mag1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
  const mag2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));

  // If either magnitude is 0 (zero vector), return similarity as 0
  if (mag1 === 0 || mag2 === 0) {
    return 0; 
  }

  // Final cosine similarity value
  const similarity = dotProduct / (mag1 * mag2);

  // Clamp the result to the range [-1, 1] and return
  return Math.max(-1, Math.min(1, similarity));
};

// 2. Fixed LLM prompt for improvement suggestions
export const getImprovementSuggestions = async (resumeText, jobDesc, openaiClient) => { //
  try {
    validateInputs(resumeText, jobDesc);

    // Truncate inputs if too long for the model
    const maxLength = 2000;
    const truncatedResume =
      resumeText.length > maxLength
        ? resumeText.substring(0, maxLength) + "..."
        : resumeText;
    const truncatedJobDesc =
      jobDesc.length > maxLength
        ? jobDesc.substring(0, maxLength) + "..."
        : jobDesc;

    // Construct the prompt
    const prompt = `You are a resume optimization expert specifically for software engineering freshers. 

Before providing suggestions, first assess whether the job description is relevant to the provided resume. 

If the job description is irrelevant or unrelated, respond only with:

"The job description appears unrelated to the resume provided. Please check and provide a relevant job description for accurate suggestions."

If relevant, analyze the resume against the job description and provide specific, actionable improvement suggestions.

For each suggestion, cite or mention reliable sources such as industry best practices, well-known career advice websites, or research studies to back your advice.

Resume:
${truncatedResume}

Job Requirements:
${truncatedJobDesc}

Please provide 4 clear, numbered suggestions with these exact headings and brief, actionable advice under each:

1. Missing keywords for ATS optimization:
   - Identify important keywords from the job description that are missing in the resume.
   - Suggest how to naturally incorporate these keywords.

2. Skills or experience gaps:
   - Point out any skills or experience mentioned in the job description that are missing or underrepresented in the resume.
   - Suggest ways to address these gaps or highlight related experience.

3. Resume formatting improvements:
   - Suggest specific, practical formatting changes to improve readability and ATS compatibility.
   - Mention layout, font choices, section organization, bullet points, or any formatting best practices.

4. Relevant achievements to highlight:
   - Recommend achievements or accomplishments to emphasize based on the job requirements.
   - Suggest how to quantify or phrase these achievements for greater impact.

If there are no significant issues or suggestions for any section, state "No significant issues found" under that heading.


Keep suggestions concise, practical, and easy to implement.

Begin now:

1. Missing keywords for ATS optimization:`;

    // Try Send prompt to AI model
    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "system",
          content: "You are an expert in resume analysis and job matching.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const suggestions = response.choices?.[0]?.message?.content?.trim();

    // 4. Validate and return response 
    if (!suggestions || suggestions.length < 30) {
      throw new Error("AI returned empty or insufficient suggestions.");
    }

    return suggestions;
  } catch (err) {
    console.error("AI suggestion error:", err.message);

    // Fallback to basic suggestions if AI fails
    try {
      return getBasicSuggestions(
        resumeText.substring(0, 2000),
        jobDesc.substring(0, 2000)
      );
    } catch (fallbackErr) {
      throw new Error(`Failed to generate suggestions: ${err.message}`);
    }
  }
};

// Fallback function for basic suggestions
const getBasicSuggestions = (resumeText, jobDesc) => {
  const resume = resumeText.toLowerCase();
  const job = jobDesc.toLowerCase();

  const suggestions = [];

  // Check for common technical skills
  const techSkills = [
    "html",
    "css",
    "javascript",
    "python",
    "java",
    "react",
    "node",
    "sql",
    "aws",
    "azure",
    "docker",
    "kubernetes",
  ];
  const missingSkills = techSkills.filter(
    (skill) => job.includes(skill) && !resume.includes(skill)
  );

  if (missingSkills.length > 0) {
    suggestions.push(
      `Consider adding these missing technical skills if you have them: ${missingSkills.join(
        ", "
      )}`
    );
  }

  // Check for experience keywords
  if (
    job.includes("senior") &&
    !resume.includes("senior") &&
    !resume.includes("lead")
  ) {
    suggestions.push(
      "Highlight any leadership or senior-level responsibilities you've had"
    );
  }

  // Check for metrics
  if (
    !/\d+%|\d+\s*(years?|months?)|\d+\s*(million|thousand|users|customers)/.test(
      resume
    )
  ) {
    suggestions.push(
      "Add quantifiable achievements and metrics to demonstrate impact"
    );
  }

  // Check for education
  if (
    job.includes("degree") &&
    !resume.includes("degree") &&
    !resume.includes("bachelor") &&
    !resume.includes("master")
  ) {
    suggestions.push(
      "Ensure your educational background is clearly stated if required"
    );
  }

  // Check for certifications
  if (
    job.includes("certified") &&
    !resume.includes("certified") &&
    !resume.includes("certification")
  ) {
    suggestions.push("Consider mentioning relevant certifications or training");
  }

  if (suggestions.length === 0) {
    suggestions.push(
      "Your resume appears to be well-aligned with the job requirements. Consider tailoring specific achievements to match the role."
    );
  }

  return suggestions.join("\n\n");
};

// 3. Enhanced function that combines both analyses
export const analyzeResumeMatch = async (resumeText, jobDesc) => {
  try {
    console.log("Starting resume analysis...");

    // Run both analyses in parallel
    const [similarity, suggestions] = await Promise.all([
      getSimilarityScore(resumeText, jobDesc).catch((err) => {
        console.error("Similarity calculation failed:", err.message);
        return -1; // Default similarity score
      }),
      getImprovementSuggestions(resumeText, jobDesc).catch((err) => {
        console.error("Suggestions generation failed:", err.message);
        return "Unable to generate specific suggestions at this time. Please ensure your resume highlights relevant skills and experience mentioned in the job description.";
      }),
    ]);

    // Convert similarity score to percentage
    const matchPercentage = Math.round(
      Math.max(0, Math.min(100, (similarity + 1) * 50))
    );

    console.log("Analysis completed:", { similarity, matchPercentage });

    return {
      similarityScore: similarity,
      matchPercentage,
      suggestions,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Error in analyzeResumeMatch:", err.message);

    // Return a basic response rather than failing completely
    return {
      similarityScore: -1,
      matchPercentage: 0,
      suggestions:
        "Analysis failed due to an internal error. Please review the job requirements and ensure your resume highlights relevant skills, experience, and achievements that match the position.",
      timestamp: new Date().toISOString(),
      error: err.message,
    };
  }
};
