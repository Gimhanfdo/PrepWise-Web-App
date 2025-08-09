// Enhanced CV Analysis API using Gemini 2.5 Flash directly
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

// Enhanced software engineering internship-specific keywords
const SOFTWARE_ENGINEERING_KEYWORDS = [
  // Programming Languages
  'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'go', 'rust', 'swift', 'kotlin', 'scala', 'ruby', 'php',
  // Web Technologies
  'react', 'angular', 'vue', 'nodejs', 'express', 'django', 'flask', 'spring', 'html', 'css', 'bootstrap', 'tailwind',
  // Mobile Development
  'android', 'ios', 'react native', 'flutter', 'xamarin', 'swift ui',
  // Databases
  'mysql', 'postgresql', 'mongodb', 'redis', 'sqlite', 'firebase', 'dynamodb', 'cassandra',
  // Cloud & DevOps
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'github actions', 'terraform', 'ansible',
  // Tools & Frameworks
  'git', 'github', 'gitlab', 'jira', 'confluence', 'slack', 'figma', 'postman', 'swagger',
  // Concepts
  'api', 'rest', 'graphql', 'microservices', 'agile', 'scrum', 'ci/cd', 'testing', 'unit testing', 'integration testing',
  // Data Science/ML
  'machine learning', 'data science', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn',
  // Common intern-level skills
  'software development', 'web development', 'mobile development', 'full stack', 'frontend', 'backend', 'debugging'
];

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

// Enhanced similarity scoring using Gemini 2.5 Flash
const getSimilarityScore = async (resumeText, jobDesc) => {
  try {
    validateInputs(resumeText, jobDesc);

    // Pre-screening for non-tech roles
    const jobDescLower = jobDesc.toLowerCase();
    const hasNonTechIndicators = NON_TECH_INDICATORS.some(indicator => 
      jobDescLower.includes(indicator.toLowerCase())
    );

    const hasSoftwareIndicators = SOFTWARE_ENGINEERING_KEYWORDS.some(keyword => 
      jobDescLower.includes(keyword.toLowerCase())
    );

    if (hasNonTechIndicators && !hasSoftwareIndicators) {
      console.log("Non-tech role detected, returning 0 similarity");
      return 0;
    }

    const maxLength = 4000;
    const truncatedResume = resumeText.length > maxLength
      ? resumeText.substring(0, maxLength) + "..."
      : resumeText;
    const truncatedJobDesc = jobDesc.length > maxLength
      ? jobDesc.substring(0, maxLength) + "..."
      : jobDesc;

    const prompt = `You are an expert software engineering internship recruiter at top tech companies (Google, Microsoft, Meta, Amazon, Apple).

CRITICAL ASSESSMENT: Analyze if this job description is for a SOFTWARE ENGINEERING INTERNSHIP or similar technical role.

SOFTWARE ENGINEERING INTERNSHIPS include:
- Software Engineer Intern, Software Developer Intern, Web Developer Intern
- Frontend/Backend/Full-Stack Developer Intern
- Mobile Developer Intern (iOS/Android)
- Data Engineer Intern, ML Engineer Intern
- DevOps Engineer Intern, QA Engineer Intern
- Technical Product Manager Intern
- Any role requiring programming, coding, or software development skills

NON-SOFTWARE ROLES (return 0 immediately):
- Medical, Healthcare, Legal, Education, Retail, Food Service
- Marketing, Sales, HR, Administrative roles
- Any role not requiring programming or technical software skills

If this is NOT a software engineering internship, return: 0

For SOFTWARE ENGINEERING INTERNSHIPS only, evaluate the candidate:

Key Evaluation Criteria for Interns:
1. Programming Languages (40% weight): Match between candidate's languages and job requirements
2. Technical Projects (25% weight): Relevant personal/academic projects demonstrating coding skills
3. Foundational CS Knowledge (20% weight): Data structures, algorithms, basic software engineering concepts
4. Learning Aptitude (10% weight): Demonstrated ability to learn new technologies
5. Educational Background (5% weight): CS degree, bootcamp, or equivalent technical education

Resume:
${truncatedResume}

Job Description:
${truncatedJobDesc}

Return ONLY a decimal between 0.0-1.0:
- 0.0: Non-software role OR no programming skills
- 0.1-0.3: Minimal coding experience, major skill gaps
- 0.4-0.6: Some relevant skills, needs development
- 0.7-0.8: Good technical foundation for internship
- 0.9-1.0: Strong candidate with excellent technical skills

Score:`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const scoreText = response.text().trim();
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

// Enhanced fallback with software engineering focus
const getFallbackSimilarity = async (resumeText, jobDesc) => {
  try {
    const jobDescLower = jobDesc.toLowerCase();
    const resumeLower = resumeText.toLowerCase();

    // Check for non-tech indicators
    const hasNonTechIndicators = NON_TECH_INDICATORS.some(indicator => 
      jobDescLower.includes(indicator.toLowerCase())
    );

    if (hasNonTechIndicators) {
      return 0;
    }

    // Count matched keywords
    const matchedKeywords = SOFTWARE_ENGINEERING_KEYWORDS.filter(keyword => 
      jobDescLower.includes(keyword.toLowerCase()) && resumeLower.includes(keyword.toLowerCase())
    );

    const requiredKeywords = SOFTWARE_ENGINEERING_KEYWORDS.filter(keyword => 
      jobDescLower.includes(keyword.toLowerCase())
    );

    if (requiredKeywords.length === 0) {
      return 0.1;
    }

    const matchRatio = matchedKeywords.length / requiredKeywords.length;
    return Math.min(0.8, matchRatio);
  } catch (err) {
    console.error("Fallback similarity failed:", err.message);
    return 0.1;
  }
};

// Extract technologies from resume using Gemini 2.5 Flash
const extractTechnologiesFromResume = async (resumeText) => {
  try {
    const prompt = `Analyze the following resume and extract all technical skills, programming languages, frameworks, tools, and technologies mentioned. 

Resume text:
${resumeText}

Return a JSON array where each technology has:
- name: the technology name
- category: one of ["Programming Languages", "Frameworks", "Tools", "Databases", "Cloud Services", "Other"]
- confidenceLevel: estimated proficiency level 1-10 based on context (default 5 if unclear)

Example format:
[
  {"name": "JavaScript", "category": "Programming Languages", "confidenceLevel": 7},
  {"name": "React", "category": "Frameworks", "confidenceLevel": 6}
]

Only return the JSON array, no other text.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const content = response.text().trim();
    
    // Clean up the response to extract JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const technologies = JSON.parse(jsonMatch[0]);
      return technologies.filter(tech => tech.name && tech.category);
    }
    
    return [];
  } catch (error) {
    console.error("Technology extraction error:", error);
    return [];
  }
};

// Helper function to clean and parse JSON response
const parseJSONResponse = (responseText) => {
  try {
    let cleanText = responseText.replace(/```json\s*|```\s*/g, '').trim();
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }
    return JSON.parse(cleanText);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
};

// Comprehensive software engineering internship-specific recommendations using Gemini 2.5 Flash
const getStructuredRecommendations = async (resumeText, jobDesc) => {
  try {
    validateInputs(resumeText, jobDesc);

    const maxLength = 4500;
    const truncatedResume = resumeText.length > maxLength
      ? resumeText.substring(0, maxLength) + "..."
      : resumeText;
    const truncatedJobDesc = jobDesc.length > maxLength
      ? jobDesc.substring(0, maxLength) + "..."
      : jobDesc;

    const prompt = `You are a senior technical recruiter at FAANG companies with 15+ years of experience specifically recruiting SOFTWARE ENGINEERING INTERNS.

CRITICAL INSTRUCTION: First, determine if this is a SOFTWARE ENGINEERING INTERNSHIP position.

SOFTWARE ENGINEERING INTERNSHIPS: Software Engineer Intern, Web Developer Intern, Mobile Developer Intern, Full-Stack Developer Intern, Backend/Frontend Developer Intern, Data Engineer Intern, ML Engineer Intern, DevOps Intern, QA Engineer Intern, Technical roles requiring programming/coding.

NON-TECH ROLES: Medical, Legal, Education, Retail, Food Service, Marketing, Sales, HR, Administrative, or any role not requiring programming skills.

If this is NOT a software engineering internship, respond exactly: NON_TECH_ROLE

For SOFTWARE ENGINEERING INTERNSHIPS, provide detailed analysis with these verified best practices from top tech companies:

Based on research from companies like Google, Microsoft, Meta, Amazon, and industry resources like Tech Interview Handbook, provide comprehensive feedback in this exact JSON format:

{
  "strengths": [
    "Specific technical strengths with examples from their background",
    "Programming languages or technologies they know that match the role",
    "Projects or experiences that demonstrate coding ability",
    "Educational background or certifications relevant to software engineering"
  ],
  "contentWeaknesses": [
    "Missing specific programming languages mentioned in job requirements (be specific about which ones)",
    "Lack of demonstrated experience with specific frameworks/tools from job posting",
    "Missing quantified project metrics (e.g., 'Built web app serving X users', 'Optimized algorithm reducing runtime by X%')",
    "Insufficient demonstration of data structures & algorithms knowledge",
    "Missing version control (Git/GitHub) experience or portfolio links",
    "Lack of collaborative coding experience or team project involvement"
  ],
  "structureWeaknesses": [
    "Technical skills section not optimized for ATS parsing (should list languages, frameworks, tools separately)",
    "Missing GitHub portfolio link or personal website showcasing projects",
    "Project descriptions lack technical depth and specific technologies used",
    "Resume not tailored for software engineering internships (missing relevant keywords)",
    "Contact information missing professional email or LinkedIn profile optimized for tech recruiting"
  ],
  "contentRecommendations": [
    "Add specific programming languages from job posting: [list exact languages/frameworks needed]",
    "Include 2-3 detailed coding projects with: technologies used, GitHub links, live demos, and quantified impact",
    "Add coursework section highlighting: Data Structures, Algorithms, Software Engineering, Database Systems, Web Development",
    "Include technical certifications: AWS Cloud Practitioner, Google Developer Certifications, or relevant MOOCs from Coursera/edX",
    "Add coding competition experience: LeetCode profile, HackerRank, Codechef, or hackathon participation",
    "Include collaborative experience: group projects, open source contributions, or peer programming",
    "Add technical skills with proficiency levels: 'Proficient in Python, Java; Familiar with React, Node.js; Learning Kubernetes, Docker'",
    "Include relevant internship/work experience: TA positions, freelance coding work, or tech-related part-time jobs"
  ],
  "structureRecommendations": [
    "Create dedicated sections: Contact Info, Education (with relevant coursework), Technical Skills (Languages, Frameworks, Tools), Projects (with GitHub links), Experience",
    "Use technical resume template optimized for ATS: consistent formatting, clear headers, standard fonts (Arial, Calibri, Times New Roman)",
    "Add hyperlinks: GitHub profile, LinkedIn, personal portfolio website, and live project demos",
    "Optimize for applicant tracking systems: use standard section names, avoid graphics/tables, save as both PDF and .docx",
    "Include technical keywords throughout: match job posting language, use industry-standard terms",
    "Format technical skills section: categorize by type (Languages: Python, Java; Web: React, HTML/CSS; Databases: MySQL, MongoDB)",
    "Structure project descriptions: Project Name | Technologies Used | Brief description with impact/outcome | GitHub link",
    "Professional contact section: Full name, professional email (@gmail recommended for students), phone, LinkedIn URL, GitHub URL, location (city, state)"
  ]
}

Resume:
${truncatedResume}

Job Description:
${truncatedJobDesc}

Remember: Focus specifically on SOFTWARE ENGINEERING INTERNSHIP requirements. Be extremely specific about missing technical skills, provide actionable recommendations with exact technologies to learn, and reference current industry standards for intern-level positions.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text().trim();
    
    console.log("Raw Gemini response:", responseText);

    if (responseText === "NON_TECH_ROLE" || responseText.includes("NON_TECH_ROLE")) {
      return {
        isNonTechRole: true,
        message: "This job description is not for a software engineering internship or technical role. Our resume analysis tool is specifically designed for software engineering internships and related technical positions requiring programming skills. Please provide a software engineering internship job description for accurate, industry-specific resume optimization recommendations."
      };
    }

    try {
      const structuredData = parseJSONResponse(responseText);
      
      // Enhanced validation with comprehensive defaults
      const result = {
        isNonTechRole: false,
        strengths: Array.isArray(structuredData.strengths) && structuredData.strengths.length > 0 
          ? structuredData.strengths 
          : [
              "Demonstrates foundational technical education with computer science coursework",
              "Shows initiative in learning programming languages and development tools",
              "Has academic projects or personal coding experience that indicates problem-solving skills",
              "Educational background provides foundation for software engineering concepts"
            ],
        contentWeaknesses: Array.isArray(structuredData.contentWeaknesses) && structuredData.contentWeaknesses.length > 0
          ? structuredData.contentWeaknesses 
          : [
              "Missing specific programming languages mentioned in job requirements (identify which ones from posting)",
              "Lacks quantified project metrics (e.g., 'Built web application serving 500+ users' or 'Optimized algorithm reducing runtime by 40%')",
              "No visible GitHub portfolio or coding project demonstrations",
              "Missing data structures and algorithms knowledge demonstration",
              "Insufficient evidence of practical coding experience through internships or personal projects",
              "Lacks demonstration of collaborative coding or team development experience"
            ],
        structureWeaknesses: Array.isArray(structuredData.structureWeaknesses) && structuredData.structureWeaknesses.length > 0
          ? structuredData.structureWeaknesses 
          : [
              "Technical skills section not properly categorized (should separate Languages, Frameworks, Databases, Tools)",
              "Missing essential links: GitHub profile, LinkedIn, personal portfolio website",
              "Resume format not optimized for software engineering roles and ATS systems",
              "Project descriptions lack technical depth and specific implementation details",
              "Missing relevant technical keywords that match software engineering internship requirements"
            ],
        contentRecommendations: Array.isArray(structuredData.contentRecommendations) && structuredData.contentRecommendations.length > 0
          ? structuredData.contentRecommendations 
          : [
              "Add 2-3 substantial coding projects: include GitHub repositories, live demos, and detailed technical descriptions",
              "Learn and add job-relevant technologies: identify specific languages/frameworks from job posting and add them with proficiency levels",
              "Include quantified achievements: 'Developed web app with 1000+ daily users', 'Improved algorithm performance by 50%', 'Contributed to open source project with 100+ stars'",
              "Add relevant coursework section: Data Structures, Algorithms, Software Engineering, Database Systems, Web Development, Computer Networks",
              "Create comprehensive technical portfolio: personal website showcasing projects, blog posts about coding challenges, or tutorial contributions",
              "Gain practical experience: contribute to open source projects, complete coding bootcamp, or build applications using popular frameworks",
              "Add technical certifications: AWS Cloud Practitioner, Google Developer Certification, or relevant Coursera/edX course completions",
              "Include coding competition experience: LeetCode profile with problem-solving statistics, HackerRank badges, or hackathon participation"
            ],
        structureRecommendations: Array.isArray(structuredData.structureRecommendations) && structuredData.structureRecommendations.length > 0
          ? structuredData.structureRecommendations 
          : [
              "Use software engineering resume template: clean layout with sections for Contact, Summary, Education, Technical Skills, Projects, Experience",
              "Optimize technical skills section: categorize as 'Languages: Python, Java, C++', 'Web Technologies: React, HTML/CSS, Node.js', 'Databases: MySQL, MongoDB', 'Tools: Git, Docker, AWS'",
              "Add essential professional links: GitHub (github.com/username), LinkedIn (/in/fullname), personal portfolio (yourname.dev or github.io)",
              "Format for ATS compatibility: use standard fonts (Calibri, Arial), avoid graphics/tables, use consistent bullet points, save as PDF and .docx",
              "Structure project entries: 'Project Name | Tech Stack | Description with impact | GitHub Link | Live Demo'",
              "Create compelling technical summary: 2-3 lines highlighting programming languages, key projects, and career goals in software engineering",
              "Use action-oriented language: 'Developed', 'Implemented', 'Optimized', 'Collaborated', 'Designed' with specific technical outcomes",
              "Ensure professional presentation: consistent spacing, clear section headers, appropriate resume length (1 page for students), professional email format"
            ]
      };

      return result;
    } catch (parseError) {
      console.error("JSON parsing failed:", parseError.message);
      return await getFallbackStructuredRecommendations(responseText);
    }

  } catch (err) {
    console.error("Structured recommendations error:", err.message);
    return getDefaultInternshipRecommendations();
  }
};

// Enhanced fallback with internship-specific guidance
const getFallbackStructuredRecommendations = async (responseText) => {
  return getDefaultInternshipRecommendations();
};

// Comprehensive default recommendations
const getDefaultInternshipRecommendations = () => {
  return {
    isNonTechRole: false,
    strengths: [
      "Educational foundation in computer science or related technical field",
      "Demonstrates learning aptitude and interest in software development",
      "Has academic exposure to programming concepts and problem-solving",
      "Shows initiative in pursuing technical skills and knowledge"
    ],
    contentWeaknesses: [
      "Missing specific programming languages commonly required for internships (Python, Java, JavaScript, C++)",
      "Lacks demonstrated coding projects with measurable impact or user engagement",
      "No visible GitHub portfolio showcasing coding abilities and project diversity",
      "Missing practical experience with web development frameworks (React, Angular, Vue.js)",
      "Insufficient evidence of database knowledge (SQL, NoSQL) and data manipulation skills",
      "Lacks demonstration of collaborative coding experience or version control usage (Git/GitHub)"
    ],
    structureWeaknesses: [
      "Technical skills section not optimized for software engineering roles - should categorize languages, frameworks, and tools",
      "Missing essential professional links: GitHub profile, LinkedIn, and personal portfolio website",
      "Resume format not tailored for technical recruiting and ATS compatibility",
      "Project descriptions lack technical depth, specific technologies used, and quantified outcomes",
      "Contact information missing elements critical for tech recruiting (professional email, GitHub, LinkedIn)"
    ],
    contentRecommendations: [
      "Build 2-3 substantial coding projects: full-stack web application, mobile app, or API service with complete GitHub documentation",
      "Learn industry-standard technologies: master one backend language (Python/Java), one frontend framework (React/Vue), and database skills (SQL)",
      "Create measurable project impact: 'Built e-commerce site handling 500+ products', 'Developed mobile app with 4.5/5 user rating', 'Optimized database queries reducing load time by 60%'",
      "Add relevant computer science coursework: Data Structures & Algorithms, Software Engineering, Database Systems, Web Development, Computer Networks",
      "Gain practical development experience: contribute to open source projects, complete coding bootcamp modules, or freelance small development projects",
      "Pursue technical certifications: AWS Cloud Practitioner, Google Developer Certification, Meta Frontend Developer, or IBM Data Science certificates",
      "Build coding portfolio: solve 50+ LeetCode problems, participate in hackathons, or contribute to GitHub projects with documentation",
      "Add collaborative experience: pair programming projects, group software development coursework, or team-based hackathon participation"
    ],
    structureRecommendations: [
      "Use technical resume format: Contact Information, Professional Summary, Education (with relevant coursework), Technical Skills, Projects, Experience sections",
      "Organize technical skills strategically: 'Programming Languages: Python, Java, JavaScript', 'Web Technologies: React, HTML/CSS, Node.js', 'Databases: MySQL, PostgreSQL', 'Tools: Git, Docker, VS Code'",
      "Add professional links prominently: GitHub profile (github.com/username), LinkedIn (/in/fullname), personal website or portfolio (yourname.github.io)",
      "Optimize for applicant tracking systems: use standard resume format, avoid graphics/tables, use consistent fonts (Calibri/Arial), maintain clear section hierarchy",
      "Structure project descriptions effectively: 'Project Name | Technologies Used | Brief description with specific impact | GitHub repository link | Live demo URL'",
      "Create compelling professional summary: 2-3 lines highlighting programming expertise, notable projects, and internship goals in software engineering",
      "Use technical action verbs throughout: 'Developed', 'Implemented', 'Architected', 'Optimized', 'Collaborated' with quantified technical outcomes",
      "Ensure professional presentation: consistent formatting, appropriate white space, one-page length for students, professional email address format"
    ]
  };
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
    
    suggestions += "**Actionable Recommendations for Software Engineering Internships:**\n";
    suggestions += structured.contentRecommendations.concat(structured.structureRecommendations)
      .map(r => `• ${r}`).join('\n');

    return suggestions;
  } catch (err) {
    console.error("Legacy suggestions error:", err.message);
    return "Unable to generate internship-specific recommendations. Please ensure both the resume and job description are for software engineering internship positions.";
  }
};

// Enhanced combined function with internship-specific analysis
const analyzeResumeMatch = async (resumeText, jobDesc) => {
  try {
    console.log("Starting comprehensive software engineering internship analysis...");

    const [similarity, structuredAnalysis] = await Promise.all([
      getSimilarityScore(resumeText, jobDesc).catch((err) => {
        console.error("Similarity calculation failed:", err.message);
        return 0;
      }),
      getStructuredRecommendations(resumeText, jobDesc).catch((err) => {
        console.error("Structured analysis failed:", err.message);
        return getDefaultInternshipRecommendations();
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
        warning: "Non-software engineering internship role detected"
      };
    }

    // Enhanced percentage calculation for internship-specific scoring
    let matchPercentage;
    if (similarity === 0) {
      matchPercentage = 0;
    } else if (similarity < 0.3) {
      matchPercentage = Math.round(similarity * 33);
    } else if (similarity < 0.5) {
      matchPercentage = Math.round(10 + (similarity - 0.3) * 75);
    } else if (similarity < 0.7) {
      matchPercentage = Math.round(25 + (similarity - 0.5) * 125);
    } else if (similarity < 0.85) {
      matchPercentage = Math.round(50 + (similarity - 0.7) * 200);
    } else {
      matchPercentage = Math.round(80 + (similarity - 0.85) * 133);
    }

    matchPercentage = Math.max(0, Math.min(100, matchPercentage));

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
      ...getDefaultInternshipRecommendations(),
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
  analyzeResumeMatch,
  extractTechnologiesFromResume,
  createResumeHash
};