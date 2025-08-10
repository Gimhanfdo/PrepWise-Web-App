// Enhanced CV Analysis API with Senior HR-Level Accuracy
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from "crypto";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const validateInputs = (text1, text2) => {
  if (
    !text1 ||
    !text2 ||
    typeof text1 !== "string" ||
    typeof text2 !== "string"
  ) {
    throw new Error("Both inputs must be non-empty strings");
  }
  if (text1.length > 50000 || text2.length > 50000) {
    throw new Error("Input text too long (max 50,000 characters)");
  }
};

// More comprehensive and weighted keyword categories
const KEYWORD_CATEGORIES = {
  // Core Programming (High Weight - 30%)
  CORE_LANGUAGES: {
    keywords: ['python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'go', 'rust', 'swift', 'kotlin', 'scala', 'ruby', 'php', 'c'],
    weight: 0.30
  },
  
  // Web Technologies (High Weight - 25%)
  WEB_TECH: {
    keywords: ['react', 'angular', 'vue', 'nodejs', 'express', 'django', 'flask', 'spring', 'html', 'css', 'bootstrap', 'tailwind', 'next.js', 'nuxt', 'svelte'],
    weight: 0.25
  },
  
  // Databases & Data (Medium Weight - 15%)
  DATA_SYSTEMS: {
    keywords: ['mysql', 'postgresql', 'mongodb', 'redis', 'sqlite', 'firebase', 'dynamodb', 'cassandra', 'elasticsearch', 'sql', 'nosql'],
    weight: 0.15
  },
  
  // Cloud & DevOps (Medium Weight - 12%)
  CLOUD_DEVOPS: {
    keywords: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'github actions', 'terraform', 'ansible', 'ci/cd', 'microservices'],
    weight: 0.12
  },
  
  // Tools & Version Control (Medium Weight - 10%)
  TOOLS: {
    keywords: ['git', 'github', 'gitlab', 'jira', 'confluence', 'postman', 'swagger', 'figma', 'linux', 'bash', 'npm', 'yarn'],
    weight: 0.10
  },
  
  // Specialized Skills (Lower Weight - 8%)
  SPECIALIZED: {
    keywords: ['machine learning', 'data science', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn', 'api', 'rest', 'graphql', 'testing', 'unit testing'],
    weight: 0.08
  }
};

const NON_TECH_INDICATORS = [
  'medical', 'doctor', 'physician', 'nurse', 'healthcare', 'hospital', 'clinic', 'patient',
  'law', 'lawyer', 'attorney', 'legal', 'court', 'litigation', 'paralegal',
  'teacher', 'educator', 'instructor', 'professor', 'school', 'classroom', 'curriculum',
  'retail', 'sales associate', 'cashier', 'store manager', 'customer service representative',
  'chef', 'cook', 'kitchen', 'restaurant', 'food service', 'culinary',
  'accountant', 'bookkeeper', 'financial analyst', 'audit', 'tax preparation',
  'marketing coordinator', 'social media manager', 'content creator', 'copywriter',
  'hr manager', 'human resources', 'recruiter', 'talent acquisition',
  'administrative assistant', 'secretary', 'office manager', 'receptionist',
  'warehouse', 'logistics', 'driver', 'delivery', 'shipping'
];

// Function to create a hash of the resume text for comparison
function createResumeHash(resumeText) {
  return crypto.createHash('sha256').update(resumeText.trim()).digest('hex');
}

// Advanced weighted keyword matching for more accurate scoring
const calculateWeightedKeywordMatch = (resumeText, jobDesc) => {
  const resumeLower = resumeText.toLowerCase();
  const jobDescLower = jobDesc.toLowerCase();
  
  let totalScore = 0;
  let categoryBreakdown = {};
  
  Object.entries(KEYWORD_CATEGORIES).forEach(([categoryName, categoryData]) => {
    const { keywords, weight } = categoryData;
    
    // Find keywords required by job
    const requiredKeywords = keywords.filter(keyword => 
      jobDescLower.includes(keyword.toLowerCase())
    );
    
    // Find keywords candidate has
    const candidateKeywords = keywords.filter(keyword => 
      resumeLower.includes(keyword.toLowerCase())
    );
    
    // Find matching keywords
    const matchedKeywords = requiredKeywords.filter(keyword => 
      candidateKeywords.includes(keyword)
    );
    
    if (requiredKeywords.length > 0) {
      const categoryScore = matchedKeywords.length / requiredKeywords.length;
      const weightedScore = categoryScore * weight;
      totalScore += weightedScore;
      
      categoryBreakdown[categoryName] = {
        score: categoryScore,
        matched: matchedKeywords,
        required: requiredKeywords,
        missing: requiredKeywords.filter(k => !matchedKeywords.includes(k))
      };
    }
  });
  
  return {
    overallScore: Math.min(1.0, totalScore),
    categoryBreakdown
  };
};

// Enhanced similarity scoring with multi-factor analysis
const getSimilarityScore = async (resumeText, jobDesc) => {
  try {
    validateInputs(resumeText, jobDesc);

    // Pre-screening for non-tech roles
    const jobDescLower = jobDesc.toLowerCase();
    const hasNonTechIndicators = NON_TECH_INDICATORS.some(indicator => 
      jobDescLower.includes(indicator.toLowerCase())
    );

    if (hasNonTechIndicators) {
      const techKeywords = Object.values(KEYWORD_CATEGORIES)
        .flatMap(cat => cat.keywords)
        .filter(keyword => jobDescLower.includes(keyword.toLowerCase()));
      
      if (techKeywords.length < 3) {
        console.log("Non-tech role detected, returning 0 similarity");
        return { score: 0, breakdown: null };
      }
    }

    // Get weighted keyword analysis
    const keywordAnalysis = calculateWeightedKeywordMatch(resumeText, jobDesc);
    
    const maxLength = 4500;
    const truncatedResume = resumeText.length > maxLength
      ? resumeText.substring(0, maxLength) + "..."
      : resumeText;
    const truncatedJobDesc = jobDesc.length > maxLength
      ? jobDesc.substring(0, maxLength) + "..."
      : jobDesc;

    const prompt = `You are a SENIOR SOFTWARE ENGINEERING HIRING MANAGER with 15+ years at Google, Meta, Amazon, Microsoft, and Apple. You have personally reviewed 10,000+ engineering resumes and know exactly what makes a strong intern candidate.

CRITICAL ASSESSMENT FRAMEWORK:

FIRST: Verify this is a SOFTWARE ENGINEERING INTERNSHIP requiring programming skills.

EVALUATION WEIGHTS (be precise with these percentages):
1. TECHNICAL SKILLS MATCH (40%): Programming languages, frameworks, tools specifically mentioned in JD
2. PROJECT QUALITY & RELEVANCE (25%): Complexity, technologies used, measurable impact, GitHub presence
3. EXPERIENCE LEVEL APPROPRIATENESS (15%): Years of experience, internship history, academic projects
4. EDUCATIONAL FOUNDATION (10%): CS degree progress, relevant coursework, GPA if stellar (3.7+)
5. CODING PROFICIENCY INDICATORS (10%): LeetCode, GitHub contributions, hackathons, certifications

SCORING CALIBRATION (be extremely precise):
- 0.0-0.2: Minimal technical background, would need 6+ months training
- 0.2-0.4: Some coding exposure, needs significant mentorship, risky hire
- 0.4-0.6: Decent foundation, typical intern candidate, needs guidance
- 0.6-0.7: Strong technical skills, above-average intern, can contribute
- 0.7-0.8: Excellent candidate, top 15% of interns, minimal supervision needed
- 0.8-0.9: Outstanding intern, top 5%, ready for complex projects
- 0.9-1.0: Exceptional candidate, could be junior engineer, extremely rare for intern level

RESUME:
${truncatedResume}

JOB DESCRIPTION:
${truncatedJobDesc}

Provide detailed analysis in this format:
SCORE: [0.XX]
REASONING: [2-3 sentences explaining the exact score with specific examples]
TECHNICAL_MATCH: [Specific technologies they have vs need, with percentages]
PROJECT_ASSESSMENT: [Quality and relevance of their projects, 1-2 sentences]
EXPERIENCE_LEVEL: [Whether experience matches intern expectations]

Return ONLY the decimal score (0.0-1.0):`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const fullResponse = response.text().trim();
    
    // Extract score from response
    const scoreMatch = fullResponse.match(/SCORE:\s*(0?\.\d{1,2}|\d\.?\d*)/i) || 
                       fullResponse.match(/(\d?\.\d{1,2})/);
    
    let aiScore = 0.5; // Default fallback
    if (scoreMatch) {
      aiScore = Math.max(0, Math.min(1, parseFloat(scoreMatch[1])));
    }

    // Combine AI analysis with weighted keyword matching (70% AI, 30% keyword)
    const combinedScore = (aiScore * 0.7) + (keywordAnalysis.overallScore * 0.3);
    
    return {
      score: Math.max(0, Math.min(1, combinedScore)),
      breakdown: keywordAnalysis.categoryBreakdown,
      aiAnalysis: fullResponse,
      keywordScore: keywordAnalysis.overallScore,
      aiScore: aiScore
    };

  } catch (err) {
    console.error("Error in getSimilarityScore:", err.message);
    return await getFallbackSimilarity(resumeText, jobDesc);
  }
};

// Enhanced fallback with weighted analysis
const getFallbackSimilarity = async (resumeText, jobDesc) => {
  try {
    const keywordAnalysis = calculateWeightedKeywordMatch(resumeText, jobDesc);
    return {
      score: keywordAnalysis.overallScore,
      breakdown: keywordAnalysis.categoryBreakdown,
      aiAnalysis: "Fallback analysis used",
      keywordScore: keywordAnalysis.overallScore,
      aiScore: keywordAnalysis.overallScore
    };
  } catch (err) {
    console.error("Fallback similarity failed:", err.message);
    return {
      score: 0.1,
      breakdown: null,
      aiAnalysis: "Error in analysis",
      keywordScore: 0.1,
      aiScore: 0.1
    };
  }
};

// More accurate match percentage calculation
const calculateMatchPercentage = (similarityData) => {
  const score = similarityData.score;
  
  // More realistic percentage mapping based on hiring standards
  let percentage;
  
  if (score === 0) {
    percentage = 0;
  } else if (score < 0.2) {
    // Very low match: 5-20%
    percentage = Math.round(5 + (score / 0.2) * 15);
  } else if (score < 0.4) {
    // Low match: 20-40%
    percentage = Math.round(20 + ((score - 0.2) / 0.2) * 20);
  } else if (score < 0.6) {
    // Moderate match: 40-65%
    percentage = Math.round(40 + ((score - 0.4) / 0.2) * 25);
  } else if (score < 0.75) {
    // Good match: 65-80%
    percentage = Math.round(65 + ((score - 0.6) / 0.15) * 15);
  } else if (score < 0.85) {
    // Strong match: 80-90%
    percentage = Math.round(80 + ((score - 0.75) / 0.1) * 10);
  } else {
    // Excellent match: 90-98%
    percentage = Math.round(90 + ((score - 0.85) / 0.15) * 8);
  }
  
  return Math.max(0, Math.min(98, percentage)); // Cap at 98% to be realistic
};

// Job-specific strengths analysis
const extractJobSpecificStrengths = async (resumeText, jobDesc) => {
  try {
    const prompt = `As a SENIOR HIRING MANAGER, analyze this resume against the specific job requirements and identify ONLY strengths that are directly relevant to this position.

INSTRUCTIONS:
- Focus on specific technical skills, projects, or experiences that DIRECTLY match job requirements
- Include 2-3 job-specific strengths and 1-2 general professional strengths maximum
- Be specific about technologies, frameworks, or skills mentioned in BOTH resume and job description
- Quantify achievements when possible
- Avoid generic statements

RESUME:
${resumeText.substring(0, 4000)}

JOB DESCRIPTION:
${jobDesc.substring(0, 4000)}

Return 4-6 specific strengths in this format:
1. [Specific technical skill/project matching JD requirements]
2. [Another specific match with quantifiable detail if possible]
3. [Relevant experience or educational background]
4. [Professional quality that supports technical work]

STRENGTHS:`;

    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();
    
    // Parse the response into an array
    const strengthsLines = response
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '').trim())
      .filter(line => line.length > 10);
    
    return strengthsLines.slice(0, 6); // Ensure max 6 strengths
  } catch (error) {
    console.error("Job-specific strengths extraction error:", error);
    return [
      "Demonstrates technical foundation relevant to software engineering roles",
      "Shows learning aptitude and commitment to skill development",
      "Educational background provides necessary computer science fundamentals"
    ];
  }
};

// Enhanced structured recommendations with job-specific analysis
const getStructuredRecommendations = async (resumeText, jobDesc) => {
  try {
    validateInputs(resumeText, jobDesc);

    // Check if non-tech role
    const jobDescLower = jobDesc.toLowerCase();
    const hasNonTechIndicators = NON_TECH_INDICATORS.some(indicator => 
      jobDescLower.includes(indicator.toLowerCase())
    );

    if (hasNonTechIndicators) {
      const techKeywords = Object.values(KEYWORD_CATEGORIES)
        .flatMap(cat => cat.keywords)
        .filter(keyword => jobDescLower.includes(keyword.toLowerCase()));
      
      if (techKeywords.length < 3) {
        return {
          isNonTechRole: true,
          message: "This job description is not for a software engineering internship or technical role requiring programming skills. Please provide a software engineering internship job description for accurate analysis."
        };
      }
    }

    // Get job-specific strengths
    const jobSpecificStrengths = await extractJobSpecificStrengths(resumeText, jobDesc);

    const maxLength = 4500;
    const truncatedResume = resumeText.length > maxLength
      ? resumeText.substring(0, maxLength) + "..."
      : resumeText;
    const truncatedJobDesc = jobDesc.length > maxLength
      ? jobDesc.substring(0, maxLength) + "..."
      : jobDesc;

    const prompt = `You are a FAANG SENIOR TECHNICAL RECRUITER with 20+ years of experience. You've hired 500+ software engineering interns and know exactly what separates strong candidates from weak ones.

CRITICAL ANALYSIS FRAMEWORK:

Analyze this resume against the job requirements and provide brutally honest, actionable feedback. Focus on what's MISSING or WEAK compared to successful intern candidates you've hired.

KEY FOCUS AREAS:
1. Technical skills gaps (be specific about missing languages/frameworks from JD)
2. Project quality issues (lack of complexity, missing GitHub, no quantified impact)
3. Resume structure problems (ATS incompatibility, poor formatting, missing links)
4. Experience gaps (insufficient coding experience, no collaborative projects)

RESUME:
${truncatedResume}

JOB DESCRIPTION:
${truncatedJobDesc}

Provide analysis in this exact JSON format:
{
  "contentWeaknesses": [
    "Missing [specific technology from JD]: This role requires [X] but resume shows no experience",
    "Projects lack technical depth: No evidence of [specific skill area] mentioned in JD requirements",
    "No quantified project impact: Missing metrics like 'built app with X users' or 'improved performance by X%'",
    "Insufficient [specific area] experience for this role's requirements"
  ],
  "structureWeaknesses": [
    "Technical skills section poorly organized for ATS parsing and recruiter review",
    "Missing critical professional links: GitHub portfolio, LinkedIn profile, or project demos",
    "Resume format not optimized for software engineering roles (specific formatting issues)",
    "Project descriptions lack technical details and implementation specifics"
  ],
  "contentRecommendations": [
    "Learn [specific technologies from JD]: Focus on [X, Y, Z] which are core requirements for this role",
    "Build [specific type of project] using [technologies from JD] to demonstrate relevant skills",
    "Add quantified achievements: Include metrics like user engagement, performance improvements, or scale",
    "Gain experience with [specific tool/framework] through online courses or personal projects"
  ],
  "structureRecommendations": [
    "Reorganize technical skills section: Group as 'Languages: [list]', 'Frameworks: [list]', 'Tools: [list]'",
    "Add essential links: GitHub profile with 3+ projects, LinkedIn, and personal portfolio website",
    "Optimize resume format: Use ATS-friendly template with clear sections and consistent formatting",
    "Enhance project descriptions: Include tech stack, GitHub links, live demos, and specific outcomes"
  ]
}

Be specific about technologies, tools, and frameworks mentioned in the job description. Reference successful intern profiles you've seen.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text().trim();
    
    try {
      const structuredData = JSON.parse(responseText.replace(/```json\s*|```\s*/g, ''));
      
      return {
        isNonTechRole: false,
        strengths: jobSpecificStrengths,
        contentWeaknesses: structuredData.contentWeaknesses || [],
        structureWeaknesses: structuredData.structureWeaknesses || [],
        contentRecommendations: structuredData.contentRecommendations || [],
        structureRecommendations: structuredData.structureRecommendations || []
      };
    } catch (parseError) {
      console.error("JSON parsing failed, using fallback");
      return {
        isNonTechRole: false,
        strengths: jobSpecificStrengths,
        ...getDefaultInternshipRecommendations()
      };
    }

  } catch (err) {
    console.error("Structured recommendations error:", err.message);
    return {
      isNonTechRole: false,
      strengths: ["Shows technical interest and educational foundation"],
      ...getDefaultInternshipRecommendations()
    };
  }
};

// Default recommendations (fallback)
const getDefaultInternshipRecommendations = () => {
  return {
    contentWeaknesses: [
      "Missing key programming languages commonly required for software engineering internships",
      "Lacks substantial coding projects demonstrating practical software development skills",
      "No visible GitHub portfolio showcasing code quality and project diversity",
      "Missing experience with popular frameworks and technologies used in modern development"
    ],
    structureWeaknesses: [
      "Technical skills section not optimally structured for software engineering roles",
      "Missing professional links essential for technical recruiting (GitHub, LinkedIn, portfolio)",
      "Resume format not tailored for ATS systems used by tech companies",
      "Project descriptions lack technical depth and specific implementation details"
    ],
    contentRecommendations: [
      "Build 2-3 substantial coding projects using technologies mentioned in job postings",
      "Learn industry-standard programming languages and frameworks relevant to target roles",
      "Create quantifiable project outcomes with user metrics and performance improvements",
      "Contribute to open source projects or participate in coding challenges to demonstrate skills"
    ],
    structureRecommendations: [
      "Reorganize technical skills section with clear categories for languages, frameworks, and tools",
      "Add professional links: GitHub profile, LinkedIn, and personal portfolio website",
      "Use ATS-friendly resume format with consistent styling and clear section headers",
      "Include technical project details with technology stack, GitHub links, and live demo URLs"
    ]
  };
};

// Main analysis function with enhanced accuracy
const analyzeResumeMatch = async (resumeText, jobDesc) => {
  try {
    console.log("Starting enhanced CV analysis with senior HR-level accuracy...");

    const [similarityData, structuredAnalysis] = await Promise.all([
      getSimilarityScore(resumeText, jobDesc).catch((err) => {
        console.error("Similarity calculation failed:", err.message);
        return { score: 0, breakdown: null };
      }),
      getStructuredRecommendations(resumeText, jobDesc).catch((err) => {
        console.error("Structured analysis failed:", err.message);
        return { 
          isNonTechRole: false, 
          strengths: ["Technical foundation present"],
          ...getDefaultInternshipRecommendations() 
        };
      }),
    ]);

    if (structuredAnalysis.isNonTechRole) {
      return {
        similarityScore: 0,
        matchPercentage: 0,
        isNonTechRole: true,
        message: structuredAnalysis.message,
        timestamp: new Date().toISOString(),
        warning: "Non-software engineering role detected"
      };
    }

    // Calculate more accurate match percentage
    const matchPercentage = calculateMatchPercentage(similarityData);

    return {
      similarityScore: similarityData.score,
      matchPercentage,
      isNonTechRole: false,
      strengths: structuredAnalysis.strengths || [],
      contentWeaknesses: structuredAnalysis.contentWeaknesses || [],
      structureWeaknesses: structuredAnalysis.structureWeaknesses || [],
      contentRecommendations: structuredAnalysis.contentRecommendations || [],
      structureRecommendations: structuredAnalysis.structureRecommendations || [],
      categoryBreakdown: similarityData.breakdown,
      keywordScore: similarityData.keywordScore,
      aiScore: similarityData.aiScore,
      timestamp: new Date().toISOString(),
    };

  } catch (err) {
    console.error("Error in analyzeResumeMatch:", err.message);

    return {
      similarityScore: 0,
      matchPercentage: 0,
      isNonTechRole: false,
      strengths: ["Technical foundation present"],
      ...getDefaultInternshipRecommendations(),
      timestamp: new Date().toISOString(),
      error: err.message,
    };
  }
};

// Extract technologies from resume
const extractTechnologiesFromResume = async (resumeText) => {
  try {
    const prompt = `Extract ALL technical skills from this resume. Be comprehensive and categorize properly.

Resume:
${resumeText}

Return JSON array with exact format:
[
  {"name": "JavaScript", "category": "Programming Languages", "confidenceLevel": 7},
  {"name": "React", "category": "Frameworks", "confidenceLevel": 6}
]

Categories: "Programming Languages", "Frameworks", "Tools", "Databases", "Cloud Services", "Other"
Confidence: 1-10 based on context depth.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();
    
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]).filter(tech => tech.name && tech.category);
    }
    
    return [];
  } catch (error) {
    console.error("Technology extraction error:", error);
    return [];
  }
};

// Legacy function for backward compatibility
const getImprovementSuggestions = async (resumeText, jobDesc) => {
  try {
    const structured = await getStructuredRecommendations(resumeText, jobDesc);
    
    if (structured.isNonTechRole) {
      return structured.message;
    }

    let suggestions = "**Key Strengths:**\n";
    suggestions += structured.strengths.map(s => `• ${s}`).join('\n') + '\n\n';
    
    suggestions += "**Critical Areas for Improvement:**\n";
    suggestions += structured.contentWeaknesses.concat(structured.structureWeaknesses)
      .map(w => `• ${w}`).join('\n') + '\n\n';
    
    suggestions += "**Actionable Recommendations:**\n";
    suggestions += structured.contentRecommendations.concat(structured.structureRecommendations)
      .map(r => `• ${r}`).join('\n');

    return suggestions;
  } catch (err) {
    console.error("Legacy suggestions error:", err.message);
    return "Unable to generate recommendations. Please ensure both resume and job description are provided.";
  }
};

// Export functions
export {
  getSimilarityScore,
  getImprovementSuggestions,
  getStructuredRecommendations,
  analyzeResumeMatch,
  extractTechnologiesFromResume,
  createResumeHash
};