import OpenAI from "openai";

const AI = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

const validateInputs = (text1, text2) => {
  if (
    !text1 ||
    !text2 ||
    typeof text1 !== "string" ||
    typeof text2 !== "string"
  ) {``
    throw new Error("Both inputs must be non-empty strings");
  }
  if (text1.length > 50000 || text2.length > 50000) {
    throw new Error("Input text too long (max 50,000 characters)");
  }
};

// Enhanced similarity scoring with content and structure analysis
const getSimilarityScore = async (resumeText, jobDesc) => {
  try {
    validateInputs(resumeText, jobDesc);

    const maxLength = 4000;
    const truncatedResume =
      resumeText.length > maxLength
        ? resumeText.substring(0, maxLength) + "..."
        : resumeText;
    const truncatedJobDesc =
      jobDesc.length > maxLength
        ? jobDesc.substring(0, maxLength) + "..."
        : jobDesc;

    const prompt = `You are an expert resume-job matching system. Analyze the resume and job description for compatibility.

CRITICAL FIRST STEP: Determine if this job is for software engineering or any other technology-related role.

If the job is NOT related to software engineering or technology (examples: doctor, lawyer, teacher, retail manager, chef, nurse, accountant, marketing manager, sales representative, customer service, etc.), return exactly: 0

For software engineering and technology roles only, evaluate:
1. Technical skills alignment (programming languages, frameworks, tools)
2. Experience level match (junior/senior requirements vs experience)
3. Domain knowledge relevance (web dev, mobile, AI/ML, etc.)
4. Educational background alignment
5. Project/work experience relevance

Resume:
${truncatedResume}

Job Description:
${truncatedJobDesc}

Respond with ONLY a number between 0 and 1 (decimal format like 0.75):
- 0.0: No match or completely unrelated field (non-tech roles)
- 0.1-0.3: Poor match, significant gaps in tech skills
- 0.4-0.6: Moderate match, some relevant technical skills
- 0.6-0.8: Good match, most technical requirements met
- 0.8-1.0: Excellent match, highly qualified for tech role

Score:`;

    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "system",
          content: "You are a precise resume-job matching algorithm. Respond only with a decimal number between 0 and 1."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 10
    });

    const scoreText = response.choices?.[0]?.message?.content?.trim();
    const score = parseFloat(scoreText);

    if (isNaN(score) || score < 0 || score > 1) {
      console.warn("Invalid score returned, using fallback calculation");
      return await getFallbackSimilarity(resumeText, jobDesc);
    }

    return Math.max(0, Math.min(1, score));
  } catch (err) {
    console.error("Error in getSimilarityScore:", err.message);
    return await getFallbackSimilarity(resumeText, jobDesc);
  }
};

// Fallback similarity calculation using keyword matching
const getFallbackSimilarity = async (resumeText, jobDesc) => {
  try {
    const prompt = `Extract key technical terms and skills from this job description. Focus on programming languages, frameworks, tools, and technical concepts.

Job Description:
${jobDesc.substring(0, 2000)}

List only the technical keywords (comma-separated):`;

    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 200
    });

    const keywords = response.choices?.[0]?.message?.content?.trim()
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);

    if (!keywords || keywords.length === 0) {
      return 0.1;
    }

    const resumeLower = resumeText.toLowerCase();
    const matchedKeywords = keywords.filter(keyword => 
      resumeLower.includes(keyword)
    );

    const matchRatio = matchedKeywords.length / keywords.length;
    return Math.min(0.8, matchRatio);
  } catch (err) {
    console.error("Fallback similarity failed:", err.message);
    return 0.1;
  }
};

// Helper function to clean and parse JSON response
const parseJSONResponse = (responseText) => {
  try {
    // Remove any markdown code blocks
    let cleanText = responseText.replace(/```json\s*|```\s*/g, '').trim();
    
    // Try to find JSON object in the response
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }
    
    return JSON.parse(cleanText);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
};

// Enhanced function to get structured recommendations with strengths and weaknesses
const getStructuredRecommendations = async (resumeText, jobDesc) => {
  try {
    validateInputs(resumeText, jobDesc);

    const maxLength = 4500;
    const truncatedResume =
      resumeText.length > maxLength
        ? resumeText.substring(0, maxLength) + "..."
        : resumeText;
    const truncatedJobDesc =
      jobDesc.length > maxLength
        ? jobDesc.substring(0, maxLength) + "..."
        : jobDesc;

    const prompt = `You are a senior technical recruiter and resume optimization expert with 15+ years of experience in SOFTWARE ENGINEERING recruitment.

CRITICAL INSTRUCTION: First, carefully analyze the job description to determine if it is for a SOFTWARE ENGINEERING or TECHNOLOGY role.

SOFTWARE ENGINEERING/TECH ROLES include: Software Developer, Web Developer, Mobile Developer, Full Stack Developer, Frontend Developer, Backend Developer, DevOps Engineer, Data Scientist, Machine Learning Engineer, Software Engineer, QA Engineer, Cybersecurity Specialist, Cloud Engineer, System Administrator, Database Administrator, Technical Lead, Engineering Manager, Product Manager (technical), UI/UX Designer (technical), and similar technology positions.

NON-TECH ROLES include: Doctor, Lawyer, Teacher, Retail Manager, Chef, Nurse, Accountant, Financial Analyst, Marketing Manager, Sales Representative, Customer Service Representative, HR Manager, Operations Manager, Project Manager (non-technical), Administrative Assistant, and any role that doesn't require programming or technical skills.

IF THE JOB IS NOT A SOFTWARE ENGINEERING OR TECHNOLOGY ROLE, respond with exactly this text and nothing else:
NON_TECH_ROLE

IF THE JOB IS A SOFTWARE ENGINEERING OR TECHNOLOGY ROLE, analyze the resume against the job description and respond with ONLY valid JSON in this exact format:

{
  "strengths": [
    "First major strength based on technical skills or experience alignment",
    "Second strength about relevant background or qualifications", 
    "Third strength about overall profile fit for this type of role"
  ],
  "contentWeaknesses": [
    "Missing specific technical skill/technology mentioned in job requirements",
    "Gap in required experience area or qualification level",
    "Lack of relevant industry experience or domain knowledge",
    "Missing certifications or educational requirements"
  ],
  "structureWeaknesses": [
    "Resume formatting issues that could affect ATS parsing",
    "Poor organization or section structure problems",
    "Length, density, or readability issues",
    "Missing important sections or poor information hierarchy"
  ],
  "contentRecommendations": [
    "Add missing technical skills: [list specific technologies from job requirements]",
    "Highlight relevant experience type: [specify area] if you have it",
    "Include missing qualifications: [specific certifications or education]",
    "Add industry keywords: [list 4-5 key terms from job posting]",
    "Emphasize relevant project types or technical domains if applicable"
  ],
  "structureRecommendations": [
    "Optimize resume format for ATS compatibility (standard fonts, clear headers, proper spacing)",
    "Improve technical skills section organization (group by categories: Languages, Frameworks, Tools)",
    "Enhance overall document structure and visual hierarchy for better scanning",
    "Adjust resume length and content density for optimal readability",
    "Use consistent formatting throughout (bullet points, dates, section headers)"
  ]
}

Resume:
${truncatedResume}

Job Description:
${truncatedJobDesc}`;

    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "system",
          content: "You are a world-class technical recruiting expert specializing in SOFTWARE ENGINEERING roles only. Always respond with either exactly 'NON_TECH_ROLE' or valid JSON only. No explanations or additional text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2500
    });

    const responseText = response.choices?.[0]?.message?.content?.trim();
    console.log("Raw AI response:", responseText); // Debug log

    if (responseText === "NON_TECH_ROLE" || responseText.includes("NON_TECH_ROLE")) {
      return {
        isNonTechRole: true,
        message: "This job description is not for a software engineering or technology role. Our resume analysis tool is specifically designed for technical positions in software development, web development, mobile development, data science, DevOps, cybersecurity, and related fields. Please provide a software engineering job description for accurate resume optimization suggestions."
      };
    }

    try {
      const structuredData = parseJSONResponse(responseText);
      
      // Validate the structure and provide comprehensive defaults
      const result = {
        isNonTechRole: false,
        strengths: Array.isArray(structuredData.strengths) && structuredData.strengths.length > 0 
          ? structuredData.strengths 
          : ["Resume demonstrates relevant technical experience", "Shows problem-solving capabilities through project work", "Has educational background aligned with technical requirements"],
        contentWeaknesses: Array.isArray(structuredData.contentWeaknesses) && structuredData.contentWeaknesses.length > 0
          ? structuredData.contentWeaknesses 
          : ["Missing specific technical skills mentioned in job requirements", "Lacks quantified achievements in key experience areas", "Could better highlight relevant project experience", "Missing industry-specific keywords"],
        structureWeaknesses: Array.isArray(structuredData.structureWeaknesses) && structuredData.structureWeaknesses.length > 0
          ? structuredData.structureWeaknesses 
          : ["Resume formatting could be optimized for ATS systems", "Technical skills section could be better organized", "Project descriptions could be more prominently displayed", "Contact information or summary could be enhanced"],
        contentRecommendations: Array.isArray(structuredData.contentRecommendations) && structuredData.contentRecommendations.length > 0
          ? structuredData.contentRecommendations 
          : ["Add specific technical skills from job requirements with proficiency levels", "Include quantified metrics for project impact (e.g., performance improvements, user numbers)", "Highlight relevant coursework or certifications that match job requirements", "Add industry-specific keywords throughout experience descriptions", "Include collaborative and leadership experiences with specific examples"],
        structureRecommendations: Array.isArray(structuredData.structureRecommendations) && structuredData.structureRecommendations.length > 0
          ? structuredData.structureRecommendations 
          : ["Use consistent bullet point formatting throughout all sections", "Organize technical skills by categories (Languages, Frameworks, Tools)", "Place most relevant experience/projects at the top of each section", "Use clear section headers and adequate white space", "Ensure contact information is prominently displayed and professional"]
      };

      return result;
    } catch (parseError) {
      console.error("JSON parsing failed:", parseError.message);
      console.error("Response was:", responseText);
      return await getFallbackStructuredRecommendations(responseText);
    }

  } catch (err) {
    console.error("Structured recommendations error:", err.message);
    return {
      isNonTechRole: false,
      strengths: ["Resume shows technical aptitude and relevant background", "Demonstrates problem-solving through various experiences", "Educational foundation aligns with technical requirements"],
      contentWeaknesses: ["Missing specific technical skills from job requirements", "Could include more quantified achievements", "Lacks detailed project descriptions", "Missing relevant industry keywords"],
      structureWeaknesses: ["Resume formatting could be optimized for better readability", "Technical skills organization could be improved", "Section hierarchy could be enhanced", "ATS compatibility could be better"],
      contentRecommendations: ["Research and add specific technical skills mentioned in the job posting", "Quantify achievements with specific numbers and metrics", "Include detailed project descriptions with technologies used", "Add relevant keywords from the job description naturally", "Highlight any collaborative or leadership experiences"],
      structureRecommendations: ["Use consistent formatting and bullet points throughout", "Create clear sections with proper hierarchy", "Organize technical skills by relevant categories", "Ensure adequate white space and readability", "Use professional formatting that's ATS-friendly"]
    };
  }
};

// Improved fallback function to parse non-JSON responses into structured format
const getFallbackStructuredRecommendations = async (responseText) => {
  try {
    // Try to extract information from unstructured response
    const lines = responseText.split('\n').filter(line => line.trim());
    
    // Look for key sections
    let strengths = [];
    let contentWeaknesses = [];
    let structureWeaknesses = [];
    let contentRecommendations = [];
    let structureRecommendations = [];
    
    let currentSection = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.toLowerCase().includes('strength')) {
        currentSection = 'strengths';
        continue;
      } else if (trimmedLine.toLowerCase().includes('weakness') || trimmedLine.toLowerCase().includes('gap')) {
        currentSection = 'weaknesses';
        continue;
      } else if (trimmedLine.toLowerCase().includes('recommend')) {
        currentSection = 'recommendations';
        continue;
      }
      
      // Extract bullet points or sentences
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        const cleanLine = trimmedLine.substring(1).trim();
        if (cleanLine.length > 10) {
          switch (currentSection) {
            case 'strengths':
              strengths.push(cleanLine);
              break;
            case 'weaknesses':
              contentWeaknesses.push(cleanLine);
              break;
            case 'recommendations':
              contentRecommendations.push(cleanLine);
              break;
          }
        }
      }
    }
    
    // Provide comprehensive defaults if sections are empty
    if (strengths.length === 0) {
      strengths = [
        "Resume demonstrates technical competence with relevant educational background",
        "Shows practical application of technical skills through project work",
        "Indicates problem-solving ability and learning capacity"
      ];
    }
    if (contentWeaknesses.length === 0) {
      contentWeaknesses = [
        "Missing specific technologies mentioned in job requirements (identify and add relevant ones)",
        "Lacks quantified achievements that demonstrate impact (add metrics like performance improvements, user adoption)",
        "Could include more detailed project descriptions with specific technologies and methodologies used",
        "Missing industry-specific keywords that would improve ATS matching"
      ];
    }
    if (structureWeaknesses.length === 0) {
      structureWeaknesses = [
        "Resume formatting may not be optimized for ATS scanning (use standard fonts and clear section headers)",
        "Technical skills section could be better organized by categories (Languages, Frameworks, Databases)",
        "Project descriptions could be reformatted for better impact (use action verbs and quantified results)",
        "Section order could be optimized to highlight most relevant information first"
      ];
    }
    if (contentRecommendations.length === 0) {
      contentRecommendations = [
        "Research the specific tech stack mentioned in the job posting and add relevant skills you possess",
        "Add quantified metrics to achievements (e.g., 'Improved system performance by 40%' or 'Built application serving 1000+ users')",
        "Include specific project examples that demonstrate skills required for this role",
        "Add relevant certifications, coursework, or learning experiences that align with job requirements",
        "Incorporate action-oriented language that shows leadership and initiative in technical projects"
      ];
    }
    if (structureRecommendations.length === 0) {
      structureRecommendations = [
        "Use a clean, professional format with consistent spacing and bullet points throughout",
        "Organize technical skills into clear categories (Programming Languages, Web Technologies, Databases, Tools)",
        "Place your most relevant experience or projects at the top of their respective sections",
        "Ensure each bullet point starts with a strong action verb and includes specific outcomes",
        "Use standard section headers (Experience, Projects, Skills, Education) for better ATS compatibility"
      ];
    }

    return {
      isNonTechRole: false,
      strengths: strengths.slice(0, 3),
      contentWeaknesses: contentWeaknesses.slice(0, 4),
      structureWeaknesses: structureWeaknesses.slice(0, 4),
      contentRecommendations: contentRecommendations.slice(0, 5),
      structureRecommendations: structureRecommendations.slice(0, 5)
    };
  } catch (err) {
    console.error("Fallback parsing failed:", err.message);
    return {
      isNonTechRole: false,
      strengths: [
        "Resume shows technical education and foundation",
        "Demonstrates learning ability and technical curiosity",
        "Has relevant academic or project experience"
      ],
      contentWeaknesses: [
        "Missing specific technical skills mentioned in the job posting - research and add relevant ones you have",
        "Lacks quantified achievements - add specific numbers and metrics to show impact",
        "Could include more detailed descriptions of technical projects and methodologies used",
        "Missing keywords that would improve matching with job requirements"
      ],
      structureWeaknesses: [
        "Resume format could be optimized for ATS systems - use standard fonts and clear headers",
        "Technical skills organization could be improved - group by categories like Languages, Frameworks, Tools",
        "Project descriptions could be reformatted with stronger action verbs and quantified results",
        "Section ordering could be optimized to highlight most relevant information first"
      ],
      contentRecommendations: [
        "Add specific technical skills from the job posting that you possess, with proficiency levels",
        "Include quantified achievements for each major project or experience (metrics, performance improvements, scale)",
        "Highlight specific technologies, frameworks, and methodologies used in your projects",
        "Add relevant coursework, certifications, or self-learning that demonstrates continuous skill development",
        "Include examples of collaboration, problem-solving, and technical leadership"
      ],
      structureRecommendations: [
        "Use consistent formatting with clear bullet points and professional fonts throughout the document",
        "Create distinct sections with proper headers: Contact, Summary, Experience, Projects, Skills, Education",
        "Organize technical skills by categories and list most relevant ones first",
        "Ensure each experience/project bullet starts with an action verb and includes specific outcomes",
        "Maintain proper white space and readability while keeping content concise and impactful"
      ]
    };
  }
};

// Legacy function for backward compatibility
const getImprovementSuggestions = async (resumeText, jobDesc) => {
  try {
    const structured = await getStructuredRecommendations(resumeText, jobDesc);
    
    if (structured.isNonTechRole) {
      return structured.message;
    }

    // Convert structured data back to formatted text for legacy support
    let suggestions = "**Strengths:**\n";
    suggestions += structured.strengths.map(s => `• ${s}`).join('\n') + '\n\n';
    
    suggestions += "**Areas for Improvement:**\n";
    suggestions += structured.contentWeaknesses.concat(structured.structureWeaknesses)
      .map(w => `• ${w}`).join('\n') + '\n\n';
    
    suggestions += "**Recommendations:**\n";
    suggestions += structured.contentRecommendations.concat(structured.structureRecommendations)
      .map(r => `• ${r}`).join('\n');

    return suggestions;
  } catch (err) {
    console.error("Legacy suggestions error:", err.message);
    return "Unable to generate specific suggestions. Please ensure both the resume and job description are complete and relevant to software engineering roles.";
  }
};

// Enhanced combined function with structured output
const analyzeResumeMatch = async (resumeText, jobDesc) => {
  try {
    console.log("Starting comprehensive resume analysis...");

    // Get both similarity score and structured recommendations
    const [similarity, structuredAnalysis] = await Promise.all([
      getSimilarityScore(resumeText, jobDesc).catch((err) => {
        console.error("Similarity calculation failed:", err.message);
        return 0;
      }),
      getStructuredRecommendations(resumeText, jobDesc).catch((err) => {
        console.error("Structured analysis failed:", err.message);
        return {
          isNonTechRole: false,
          strengths: ["Analysis error occurred"],
          contentWeaknesses: ["Unable to analyze content"],
          structureWeaknesses: ["Unable to analyze structure"],
          contentRecommendations: ["Please try again"],
          structureRecommendations: ["Ensure proper formatting"]
        };
      }),
    ]);

    console.log("Similarity score:", similarity);
    console.log("Structured analysis completed:", !structuredAnalysis.isNonTechRole);

    if (structuredAnalysis.isNonTechRole) {
      return {
        similarityScore: 0,
        matchPercentage: 0,
        isNonTechRole: true,
        message: structuredAnalysis.message,
        timestamp: new Date().toISOString(),
        warning: "Non-technical role detected"
      };
    }

    const matchPercentage = Math.round(Math.max(0, Math.min(100, similarity * 100)));

    return {
      similarityScore: similarity,
      matchPercentage,
      isNonTechRole: false,
      strengths: structuredAnalysis.strengths || [],
      contentWeaknesses: structuredAnalysis.contentWeaknesses || [],
      structureWeaknesses: structuredAnalysis.structureWeaknesses || [],
      contentRecommendations: structuredAnalysis.contentRecommendations || [],
      structureRecommendations: structuredAnalysis.structureRecommendations || [],
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Error in analyzeResumeMatch:", err.message);

    return {
      similarityScore: 0,
      matchPercentage: 0,
      isNonTechRole: false,
      strengths: ["Analysis failed"],
      contentWeaknesses: ["Unable to analyze content issues"],
      structureWeaknesses: ["Unable to analyze structure issues"],  
      contentRecommendations: ["Please ensure the resume is complete"],
      structureRecommendations: ["Verify document formatting"],
      timestamp: new Date().toISOString(),
      error: err.message,
    };
  }
};

// Export functions
export {
  getSimilarityScore,
  getImprovementSuggestions,
  getStructuredRecommendations,
  analyzeResumeMatch
};