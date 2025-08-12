// Enhanced feedback generation for the React component
// Replace the generateDynamicFeedback function in your React component

const generateDynamicFeedback = async (questionData, response, responseText, responseTime) => {
  addDebugLog('Generating advanced feedback based on user content...');
  
  // If no valid response text, return error feedback
  if (!responseText || responseText.trim().length === 0) {
    return {
      strengths: [],
      improvements: ['Please provide a complete response to the question'],
      score: 0,
      detailedAnalysis: 'No valid response provided. Please answer the question to receive feedback.',
      communicationClarity: 1,
      technicalAccuracy: 1,
      structuredResponse: 1
    };
  }

  try {
    // Call backend API for AI-powered analysis
    const analysisResponse = await fetch('/api/interviews/analyze-response', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: questionData.question,
        questionType: questionData.type,
        responseText: responseText,
        responseTime: responseTime,
        code: response.code || null,
        expectedDuration: questionData.expectedDuration
      })
    });

    if (analysisResponse.ok) {
      const result = await analysisResponse.json();
      if (result.success && result.feedback) {
        addDebugLog(`AI-powered feedback generated successfully`);
        return result.feedback;
      }
    }
    
    addDebugLog('AI analysis failed, falling back to enhanced local analysis');
  } catch (error) {
    addDebugLog(`AI analysis error: ${error.message}`, 'error');
  }

  // Enhanced fallback analysis if AI fails
  return generateEnhancedLocalFeedback(questionData, response, responseText, responseTime);
};

// Enhanced local feedback analysis
const generateEnhancedLocalFeedback = (questionData, response, responseText, responseTime) => {
  const feedback = {
    strengths: [],
    improvements: [],
    score: 50, // Start with neutral score
    detailedAnalysis: '',
    communicationClarity: 5,
    technicalAccuracy: 5,
    structuredResponse: 5
  };

  const responseLength = responseText.trim().length;
  const wordCount = responseText.trim().split(/\s+/).length;
  const sentences = responseText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  addDebugLog(`Enhanced analysis: ${responseLength} chars, ${wordCount} words, ${sentences.length} sentences`);

  // Content depth analysis
  const contentAnalysis = analyzeContentDepth(responseText, questionData.type);
  feedback.score += contentAnalysis.score;
  feedback.strengths.push(...contentAnalysis.strengths);
  feedback.improvements.push(...contentAnalysis.improvements);

  // Communication quality analysis
  const commAnalysis = analyzeCommunicationQuality(responseText, sentences);
  feedback.communicationClarity = commAnalysis.clarity;
  feedback.structuredResponse = commAnalysis.structure;
  feedback.score += commAnalysis.score;
  feedback.strengths.push(...commAnalysis.strengths);
  feedback.improvements.push(...commAnalysis.improvements);

  // Question-specific analysis
  const questionAnalysis = analyzeQuestionSpecific(questionData, responseText, response.code);
  feedback.technicalAccuracy = questionAnalysis.technical;
  feedback.score += questionAnalysis.score;
  feedback.strengths.push(...questionAnalysis.strengths);
  feedback.improvements.push(...questionAnalysis.improvements);

  // Time management analysis
  const timeAnalysis = analyzeTimeManagement(responseTime, questionData.expectedDuration);
  feedback.score += timeAnalysis.score;
  if (timeAnalysis.feedback) {
    if (timeAnalysis.score > 0) {
      feedback.strengths.push(timeAnalysis.feedback);
    } else {
      feedback.improvements.push(timeAnalysis.feedback);
    }
  }

  // Generate detailed analysis
  feedback.detailedAnalysis = generateDetailedAnalysis(feedback, contentAnalysis, commAnalysis, questionAnalysis);

  // Ensure minimum feedback and clamp scores
  ensureFeedbackQuality(feedback);
  
  return feedback;
};

// Analyze content depth and relevance
const analyzeContentDepth = (text, questionType) => {
  const analysis = { score: 0, strengths: [], improvements: [] };
  const textLower = text.toLowerCase();

  // Keywords and concepts by question type
  const keywords = {
    behavioral: {
      positive: ['experience', 'project', 'team', 'challenge', 'learned', 'improved', 'result', 'outcome', 'responsibility', 'collaboration', 'problem', 'solution', 'leadership', 'initiative'],
      structure: ['situation', 'task', 'action', 'result', 'when', 'what', 'how', 'why', 'because', 'therefore', 'consequently']
    },
    technical_coding: {
      positive: ['algorithm', 'complexity', 'optimization', 'data structure', 'variable', 'function', 'loop', 'condition', 'array', 'object', 'method', 'efficient', 'solution', 'approach'],
      advanced: ['time complexity', 'space complexity', 'big o', 'hash map', 'binary search', 'dynamic programming', 'recursion', 'iteration']
    },
    technical_conceptual: {
      positive: ['concept', 'principle', 'example', 'difference', 'advantage', 'disadvantage', 'use case', 'implementation', 'performance', 'scalability'],
      technical: ['asynchronous', 'synchronous', 'callback', 'promise', 'api', 'database', 'framework', 'library', 'protocol', 'architecture']
    }
  };

  const relevantKeywords = keywords[questionType] || keywords.technical_conceptual;
  
  // Count relevant keywords
  let keywordScore = 0;
  let foundKeywords = [];
  
  Object.values(relevantKeywords).flat().forEach(keyword => {
    if (textLower.includes(keyword)) {
      keywordScore += 2;
      foundKeywords.push(keyword);
    }
  });

  analysis.score += Math.min(keywordScore, 30); // Cap at 30 points
  
  if (foundKeywords.length >= 5) {
    analysis.strengths.push('Used relevant technical vocabulary and concepts');
  } else if (foundKeywords.length >= 2) {
    analysis.strengths.push('Showed understanding of key concepts');
  } else {
    analysis.improvements.push('Include more specific technical terminology and concepts');
  }

  // Check for examples and specificity
  const exampleIndicators = /for example|for instance|such as|like when|consider|imagine|in my experience|i worked on|i built|i implemented/gi;
  const examples = text.match(exampleIndicators);
  
  if (examples && examples.length >= 2) {
    analysis.strengths.push('Provided multiple concrete examples');
    analysis.score += 15;
  } else if (examples && examples.length >= 1) {
    analysis.strengths.push('Included specific examples');
    analysis.score += 10;
  } else {
    analysis.improvements.push('Provide specific examples to illustrate your points');
  }

  // Check for quantifiable metrics
  const numbers = text.match(/\d+(\.\d+)?(%|percent|times|hours|days|weeks|months|years|users|requests|mb|gb|ms|seconds)/gi);
  if (numbers && numbers.length > 0) {
    analysis.strengths.push('Included quantifiable metrics and specific details');
    analysis.score += 10;
  }

  return analysis;
};

// Analyze communication quality
const analyzeCommunicationQuality = (text, sentences) => {
  const analysis = { clarity: 5, structure: 5, score: 0, strengths: [], improvements: [] };
  
  // Sentence length and variety analysis
  const avgSentenceLength = sentences.reduce((acc, s) => acc + s.split(' ').length, 0) / sentences.length;
  const sentenceLengths = sentences.map(s => s.split(' ').length);
  const lengthVariety = Math.max(...sentenceLengths) - Math.min(...sentenceLengths);

  if (avgSentenceLength >= 12 && avgSentenceLength <= 25 && lengthVariety >= 5) {
    analysis.strengths.push('Good sentence structure and variety');
    analysis.clarity += 2;
    analysis.score += 10;
  } else if (avgSentenceLength < 8) {
    analysis.improvements.push('Expand your sentences for more detailed explanations');
    analysis.clarity -= 1;
  } else if (avgSentenceLength > 30) {
    analysis.improvements.push('Break down complex sentences for better clarity');
    analysis.clarity -= 1;
  }

  // Check for connective words and logical flow
  const connectors = text.match(/\b(however|therefore|furthermore|moreover|additionally|consequently|because|since|although|while|whereas|first|second|third|finally|in conclusion|as a result|on the other hand)\b/gi);
  
  if (connectors && connectors.length >= 3) {
    analysis.strengths.push('Excellent logical flow and structure');
    analysis.structure += 2;
    analysis.score += 15;
  } else if (connectors && connectors.length >= 1) {
    analysis.strengths.push('Good use of connecting words');
    analysis.structure += 1;
    analysis.score += 8;
  } else {
    analysis.improvements.push('Use more connecting words to improve flow (however, therefore, because, etc.)');
    analysis.structure -= 1;
  }

  // Check for filler words and confidence
  const fillerWords = text.match(/\b(um|uh|like|you know|actually|basically|sort of|kind of|i think|i guess|maybe|probably)\b/gi);
  const confidenceWords = text.match(/\b(definitely|certainly|clearly|obviously|absolutely|confident|sure|believe|know|understand)\b/gi);

  if (!fillerWords || fillerWords.length <= 2) {
    analysis.strengths.push('Clear, confident communication');
    analysis.clarity += 1;
    analysis.score += 8;
  } else if (fillerWords.length > 5) {
    analysis.improvements.push('Reduce hesitation words (um, like, I think) for more confident delivery');
    analysis.clarity -= 2;
  }

  if (confidenceWords && confidenceWords.length >= 2) {
    analysis.strengths.push('Spoke with confidence and certainty');
    analysis.score += 5;
  }

  return analysis;
};

// Question-specific analysis
const analyzeQuestionSpecific = (questionData, text, code) => {
  const analysis = { technical: 5, score: 0, strengths: [], improvements: [] };

  if (questionData.type === 'behavioral') {
    return analyzeBehavioralResponse(text, analysis);
  } else if (questionData.type === 'technical_coding') {
    return analyzeCodingResponse(text, code, analysis);
  } else if (questionData.type === 'technical_conceptual') {
    return analyzeTechnicalConceptualResponse(text, analysis);
  }

  return analysis;
};

// Behavioral response analysis
const analyzeBehavioralResponse = (text, analysis) => {
  // STAR method analysis
  const starElements = {
    situation: /\b(situation|context|background|setting|when|where|during|at the time|scenario)\b/gi,
    task: /\b(task|goal|objective|responsibility|needed to|had to|required|assigned|expected)\b/gi,
    action: /\b(action|did|implemented|decided|approach|solution|steps|method|executed|performed|created|built|developed)\b/gi,
    result: /\b(result|outcome|learned|achieved|impact|success|conclusion|end|effect|improvement|benefit)\b/gi
  };

  const starCount = Object.entries(starElements).reduce((count, [element, regex]) => {
    const matches = text.match(regex);
    return count + (matches ? 1 : 0);
  }, 0);

  if (starCount >= 4) {
    analysis.strengths.push('Excellent use of STAR method (Situation, Task, Action, Result)');
    analysis.technical += 3;
    analysis.score += 25;
  } else if (starCount >= 3) {
    analysis.strengths.push('Good structure using STAR method elements');
    analysis.technical += 2;
    analysis.score += 15;
  } else if (starCount >= 2) {
    analysis.strengths.push('Shows some structured thinking');
    analysis.technical += 1;
    analysis.score += 8;
  } else {
    analysis.improvements.push('Use STAR method: describe the Situation, Task, Action taken, and Result achieved');
    analysis.technical -= 1;
  }

  // Leadership and initiative analysis
  const leadership = text.match(/\b(led|leadership|managed|coordinated|organized|initiated|took charge|responsible for|guided|mentored)\b/gi);
  if (leadership && leadership.length >= 2) {
    analysis.strengths.push('Demonstrated leadership and initiative');
    analysis.score += 10;
  }

  // Problem-solving indicators
  const problemSolving = text.match(/\b(problem|challenge|issue|difficulty|obstacle|solution|solved|resolved|overcame|addressed)\b/gi);
  if (problemSolving && problemSolving.length >= 3) {
    analysis.strengths.push('Strong focus on problem-solving');
    analysis.score += 8;
  }

  return analysis;
};

// Coding response analysis
const analyzeCodingResponse = (text, code, analysis) => {
  // Code quality analysis
  if (code && code.trim()) {
    const codeAnalysis = analyzeCodeQuality(code);
    analysis.technical += codeAnalysis.technical;
    analysis.score += codeAnalysis.score;
    analysis.strengths.push(...codeAnalysis.strengths);
    analysis.improvements.push(...codeAnalysis.improvements);
  } else {
    analysis.improvements.push('Provide code implementation along with explanation');
    analysis.technical -= 2;
    analysis.score -= 15;
  }

  // Algorithm explanation analysis
  const algorithmKeywords = text.match(/\b(algorithm|approach|strategy|method|complexity|time|space|efficient|optimize|iterate|loop|recursion|data structure|array|hash|map|tree|graph|sort|search)\b/gi);
  
  if (algorithmKeywords && algorithmKeywords.length >= 5) {
    analysis.strengths.push('Excellent technical explanation with algorithm concepts');
    analysis.technical += 2;
    analysis.score += 15;
  } else if (algorithmKeywords && algorithmKeywords.length >= 2) {
    analysis.strengths.push('Good use of technical terminology');
    analysis.technical += 1;
    analysis.score += 8;
  } else {
    analysis.improvements.push('Include more technical terms and algorithm concepts in your explanation');
  }

  // Complexity analysis mention
  const complexity = text.match(/\b(O\(|big o|time complexity|space complexity|linear|quadratic|logarithmic|constant|efficient|performance)\b/gi);
  if (complexity) {
    analysis.strengths.push('Discussed algorithm complexity and performance');
    analysis.technical += 2;
    analysis.score += 12;
  } else {
    analysis.improvements.push('Discuss time and space complexity of your solution');
  }

  return analysis;
};

// Technical conceptual response analysis
const analyzeTechnicalConceptualResponse = (text, analysis) => {
  // Technical depth
  const technicalTerms = text.match(/\b(asynchronous|synchronous|callback|promise|async|await|api|http|database|algorithm|data structure|class|object|function|variable|loop|condition|boolean|string|array|hash|map|queue|stack|thread|process|memory|cpu|performance|scalability|framework|library|protocol|architecture)\b/gi);
  
  if (technicalTerms && technicalTerms.length >= 5) {
    analysis.strengths.push('Excellent technical vocabulary and depth');
    analysis.technical += 3;
    analysis.score += 20;
  } else if (technicalTerms && technicalTerms.length >= 2) {
    analysis.strengths.push('Good technical understanding');
    analysis.technical += 1;
    analysis.score += 10;
  } else {
    analysis.improvements.push('Use more specific technical terminology');
    analysis.technical -= 1;
  }

  // Comparison and contrast
  const comparisons = text.match(/\b(difference|compare|contrast|versus|vs|while|whereas|however|on the other hand|unlike|similar|different|advantage|disadvantage|better|worse|prefer)\b/gi);
  if (comparisons && comparisons.length >= 3) {
    analysis.strengths.push('Excellent comparative analysis');
    analysis.score += 12;
  } else if (comparisons && comparisons.length >= 1) {
    analysis.strengths.push('Good comparative thinking');
    analysis.score += 6;
  } else {
    analysis.improvements.push('Compare and contrast different approaches or concepts');
  }

  return analysis;
};

// Code quality analysis
const analyzeCodeQuality = (code) => {
  const analysis = { technical: 0, score: 0, strengths: [], improvements: [] };
  
  // Basic code structure
  const hasComments = /\/\/|\/\*|\#|"""/.test(code);
  const hasVariableNames = /[a-zA-Z_][a-zA-Z0-9_]{2,}/.test(code);
  const hasLoops = /\b(for|while|forEach|map|filter|reduce)\b/.test(code);
  const hasFunctions = /\b(function|def|const\s+\w+\s*=|=>\s*{|\w+\s*\(.*\)\s*{)/.test(code);
  const hasErrorHandling = /\b(try|catch|except|if.*error|throw|raise)\b/i.test(code);
  
  if (hasComments) {
    analysis.strengths.push('Good code documentation with comments');
    analysis.technical += 1;
    analysis.score += 8;
  } else {
    analysis.improvements.push('Add comments to explain your code logic');
  }

  if (hasVariableNames) {
    analysis.strengths.push('Used descriptive variable names');
    analysis.technical += 1;
    analysis.score += 5;
  }

  if (hasLoops) {
    analysis.strengths.push('Proper use of iteration/loops');
    analysis.technical += 1;
    analysis.score += 8;
  }

  if (hasFunctions) {
    analysis.strengths.push('Good code organization with functions');
    analysis.technical += 1;
    analysis.score += 8;
  }

  if (hasErrorHandling) {
    analysis.strengths.push('Included error handling');
    analysis.technical += 2;
    analysis.score += 12;
  } else {
    analysis.improvements.push('Consider adding error handling to make code more robust');
  }

  // Code length and complexity
  const lines = code.split('\n').filter(line => line.trim()).length;
  if (lines >= 5 && lines <= 50) {
    analysis.strengths.push('Appropriate code length and complexity');
    analysis.score += 5;
  } else if (lines < 5) {
    analysis.improvements.push('Provide a more complete implementation');
  } else if (lines > 50) {
    analysis.improvements.push('Consider simplifying or breaking down the solution');
  }

  return analysis;
};

// Time management analysis
const analyzeTimeManagement = (responseTime, expectedTime) => {
  const analysis = { score: 0, feedback: null };
  
  if (!responseTime || !expectedTime) return analysis;
  
  const ratio = responseTime / expectedTime;
  
  if (ratio >= 0.7 && ratio <= 1.3) {
    analysis.feedback = 'Excellent time management';
    analysis.score = 10;
  } else if (ratio >= 0.5 && ratio <= 1.7) {
    analysis.feedback = 'Good time management';
    analysis.score = 5;
  } else if (ratio < 0.3) {
    analysis.feedback = 'Take more time to provide thorough answers';
    analysis.score = -5;
  } else if (ratio > 2.0) {
    analysis.feedback = 'Practice being more concise while maintaining detail';
    analysis.score = -3;
  }
  
  return analysis;
};

// Generate detailed analysis summary
const generateDetailedAnalysis = (feedback, contentAnalysis, commAnalysis, questionAnalysis) => {
  const strengths = feedback.strengths.slice(0, 3).join(', ').toLowerCase();
  const improvements = feedback.improvements.slice(0, 2).join(' and ').toLowerCase();
  
  let analysis = `Your response demonstrates ${strengths || 'basic understanding of the topic'}. `;
  
  if (feedback.score >= 80) {
    analysis += 'This was an excellent response with strong technical depth and clear communication. ';
  } else if (feedback.score >= 65) {
    analysis += 'This was a solid response with good technical understanding. ';
  } else if (feedback.score >= 50) {
    analysis += 'This response shows potential but has room for improvement. ';
  } else {
    analysis += 'This response needs significant improvement in several areas. ';
  }
  
  if (improvements) {
    analysis += `To enhance your future responses, focus on ${improvements}. `;
  }
  
  if (feedback.communicationClarity >= 7) {
    analysis += 'Your communication was clear and well-structured.';
  } else {
    analysis += 'Work on organizing your thoughts more clearly and using connecting words to improve flow.';
  }
  
  return analysis;
};

// Ensure feedback quality
const ensureFeedbackQuality = (feedback) => {
  // Ensure minimum feedback
  if (feedback.strengths.length === 0) {
    feedback.strengths.push('Attempted to answer the question completely');
  }
  
  if (feedback.improvements.length === 0) {
    feedback.improvements.push('Continue practicing to build confidence and technical depth');
  }

  // Remove duplicates
  feedback.strengths = [...new Set(feedback.strengths)];
  feedback.improvements = [...new Set(feedback.improvements)];

  // Clamp scores
  feedback.score = Math.max(0, Math.min(100, feedback.score));
  feedback.communicationClarity = Math.max(1, Math.min(10, feedback.communicationClarity));
  feedback.technicalAccuracy = Math.max(1, Math.min(10, feedback.technicalAccuracy));
  feedback.structuredResponse = Math.max(1, Math.min(10, feedback.structuredResponse));
};