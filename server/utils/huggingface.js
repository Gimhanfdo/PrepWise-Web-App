import axios from "axios";
import OpenAI from "openai";

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;

const AI = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

// Validation helper
const validateInputs = (text1, text2) => {
  if (
    !text1 ||
    !text2 ||
    typeof text1 !== "string" ||
    typeof text2 !== "string"
  ) {
    throw new Error("Both inputs must be non-empty strings");
  }
  if (text1.length > 10000 || text2.length > 10000) {
    throw new Error("Input text too long (max 10,000 characters)");
  }
};

// 1. Fixed Embedding-based similarity using sentence-transformers
export const getSimilarityScore = async (text1, text2) => {
  try {
    validateInputs(text1, text2);

    if (!HF_API_KEY) {
      throw new Error("HUGGINGFACE_API_KEY environment variable is not set");
    }

    // Use the correct API endpoint for sentence similarity
    const url =
      "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";
    const headers = {
      Authorization: `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json",
    };

    // For sentence similarity, we need to send both texts together
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

    // Try alternative approach if the main one fails
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
const getEmbeddingSimilarity = async (text1, text2) => {
  const url =
    "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";
  const headers = {
    Authorization: `Bearer ${HF_API_KEY}`,
    "Content-Type": "application/json",
  };

  // Get embeddings separately
  const [response1, response2] = await Promise.all([
    axios.post(url, { inputs: text1 }, { headers }),
    axios.post(url, { inputs: text2 }, { headers }),
  ]);

  console.log("Embedding responses:", {
    resp1: response1.data?.length || "invalid",
    resp2: response2.data?.length || "invalid",
  });

  let embedding1, embedding2;

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

  if (
    !Array.isArray(embedding1) ||
    !Array.isArray(embedding2) ||
    embedding1.length !== embedding2.length
  ) {
    throw new Error("Invalid embedding vectors");
  }

  // Cosine similarity calculation
  const dotProduct = embedding1.reduce(
    (sum, val, i) => sum + val * embedding2[i],
    0
  );
  const mag1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
  const mag2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));

  if (mag1 === 0 || mag2 === 0) {
    return 0; // Handle zero vectors
  }

  const similarity = dotProduct / (mag1 * mag2);
  return Math.max(-1, Math.min(1, similarity));
};

// 2. Fixed LLM prompt for improvement suggestions
export const getImprovementSuggestions = async (resumeText, jobDesc, openaiClient) => { //
  try {
    validateInputs(resumeText, jobDesc);

    // if (!HF_API_KEY) {
    //   throw new Error("HUGGINGFACE_API_KEY environment variable is not set");
    // }

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

    const prompt = `You are a resume optimization expert. Analyze this resume against the job description and provide specific, actionable improvement suggestions.

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

    // Try multiple models in order of preference
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
      max_tokens: 400,
    });

    const suggestions = response.choices?.[0]?.message?.content?.trim();

    if (!suggestions || suggestions.length < 30) {
      throw new Error("OpenAI returned empty or insufficient suggestions.");
    }

    return suggestions;
  } catch (err) {
    console.error("OpenAI suggestion error:", err.message);

    // Fallback to basic suggestion logic
  //   return getBasicSuggestions(
  //     resumeText.substring(0, 2000),
  //     jobDesc.substring(0, 2000)
  //   );
  // }

    // for (const model of models) {
    //   try {
    //     console.log(`Trying model: ${model}`);

    //     const response = await axios.post(
    //       `https://api-inference.huggingface.co/models/${model}`,
    //       {
    //         inputs: prompt,
    //         parameters: {
    //           max_new_tokens: 300,
    //           temperature: 0.7,
    //           do_sample: true,
    //           top_p: 0.9,
    //           repetition_penalty: 1.1,
    //           pad_token_id: 50256,
    //           return_full_text: false,
    //         },
    //         options: {
    //           wait_for_model: true,
    //           use_cache: false,
    //         },
    //       },
    //       {
    //         headers: {
    //           Authorization: `Bearer ${HF_API_KEY}`,
    //           "Content-Type": "application/json",
    //         },
    //         timeout: 30000, // 30 second timeout
    //       }
    //     );

    //     console.log(`${model} response:`, response.data);

    //     const text = response.data[0]?.generated_text?.trim() || "";

    //     if (text && text.length > 50) {
    //       // Clean up the response
    //       let suggestions = text.replace(prompt.trim(), "").trim();

    //       // If the model returned the full text, try to extract just the generated part
    //       if (suggestions.includes("[/INST]")) {
    //         suggestions =
    //           suggestions.split("[/INST]")[1]?.trim() || suggestions;
    //       }

    //       return (
    //         suggestions ||
    //         "Unable to generate specific suggestions at this time."
    //       );
    //     }
    //   } catch (modelError) {
    //     console.error(
    //       `Model ${model} failed:`,
    //       modelError.response?.status,
    //       modelError.message
    //     );
    //     continue; // Try next model
    //   }
    // }

    // If all models fail, provide a basic analysis
  //   return getBasicSuggestions(truncatedResume, truncatedJobDesc);
  // } catch (err) {
  //   console.error(
  //     "Error in getImprovementSuggestions:",
  //     err.response?.data || err.message
  //   );

  //   // Handle specific API errors
  //   if (err.response?.status === 503) {
  //     throw new Error(
  //       "Model is currently loading. Please try again in a few minutes."
  //     );
  //   }
  //   if (err.response?.status === 401) {
  //     throw new Error("Invalid API key");
  //   }
  //   if (err.response?.status === 429) {
  //     throw new Error("Rate limit exceeded. Please try again later.");
  //   }
  //   if (err.code === "ECONNABORTED") {
  //     throw new Error("Request timed out. Please try again.");
  //   }

    // Fallback to basic suggestions
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
        return 0.5; // Default similarity score
      }),
      getImprovementSuggestions(resumeText, jobDesc).catch((err) => {
        console.error("Suggestions generation failed:", err.message);
        return "Unable to generate specific suggestions at this time. Please ensure your resume highlights relevant skills and experience mentioned in the job description.";
      }),
    ]);

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
      similarityScore: 0.5,
      matchPercentage: 50,
      suggestions:
        "Analysis partially completed. Please review the job requirements and ensure your resume highlights relevant skills, experience, and achievements that match the position.",
      timestamp: new Date().toISOString(),
      error: err.message,
    };
  }
};
