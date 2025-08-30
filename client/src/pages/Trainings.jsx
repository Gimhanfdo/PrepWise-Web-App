import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Users, User, Clock, Calendar, CheckCircle, AlertCircle,
  TrendingUp, Award, Star, ArrowRight, Filter, Search, MapPin,
  Play, Download, Globe, MessageCircle, Video, Target
} from 'lucide-react';
import NavBar from "../components/NavBar";
import { useNavigate } from "react-router-dom";


const TrainingPage = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [bookingStep, setBookingStep] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Mock interview results data
  const interviewResults = {
    overallScore: 45,
    skills: [
      { name: 'JavaScript', category: 'technical', score: 35, type: 'programming' },
      { name: 'React', category: 'technical', score: 40, type: 'frontend' },
      { name: 'Communication', category: 'soft', score: 55, type: 'interpersonal' },
      { name: 'Problem Solving', category: 'technical', score: 50, type: 'analytical' },
      { name: 'Leadership', category: 'soft', score: 30, type: 'management' },
      { name: 'Node.js', category: 'technical', score: 25, type: 'backend' },
    ]
  };

  // Get skills that need improvement (< 60%)
  const skillsNeedingImprovement = interviewResults.skills.filter(skill => skill.score < 60);

  // Training programs data
  const trainingPrograms = [
    // Technical Skills
    {
      id: 1,
      title: 'JavaScript Fundamentals Bootcamp',
      category: 'technical',
      skillType: 'programming',
      targetSkill: 'JavaScript',
      type: 'group',
      duration: '5 sessions × 2 hours',
      groupSize: '5 participants',
      level: 'Beginner to Intermediate',
      price: 'LKR 25,000',
      instructor: 'Kasun Silva',
      rating: 4.8,
      description: 'Comprehensive JavaScript training covering ES6+, DOM manipulation, and modern development practices.',
      features: ['Live coding sessions', 'Project-based learning', 'Code reviews', 'Career guidance'],
      schedule: [
        { date: '2024-09-01', time: '10:00 AM - 12:00 PM', available: true },
        { date: '2024-09-03', time: '10:00 AM - 12:00 PM', available: true },
        { date: '2024-09-05', time: '10:00 AM - 12:00 PM', available: false },
        { date: '2024-09-08', time: '2:00 PM - 4:00 PM', available: true },
      ]
    },
    {
      id: 2,
      title: 'React Development Mastery',
      category: 'technical',
      skillType: 'frontend',
      targetSkill: 'React',
      type: 'group',
      duration: '5 sessions × 2.5 hours',
      groupSize: '5 participants',
      level: 'Intermediate',
      price: 'LKR 30,000',
      instructor: 'Priya Jayawardena',
      rating: 4.9,
      description: 'Master React development with hooks, context, and modern patterns for building scalable applications.',
      features: ['Hands-on projects', 'Best practices', 'Performance optimization', 'Industry insights'],
      schedule: [
        { date: '2024-09-10', time: '9:00 AM - 11:30 AM', available: true },
        { date: '2024-09-12', time: '9:00 AM - 11:30 AM', available: true },
        { date: '2024-09-15', time: '2:00 PM - 4:30 PM', available: true },
        { date: '2024-09-17', time: '2:00 PM - 4:30 PM', available: false },
      ]
    },
    {
      id: 3,
      title: 'Node.js Backend Development',
      category: 'technical',
      skillType: 'backend',
      targetSkill: 'Node.js',
      type: 'group',
      duration: '5 sessions × 2 hours',
      groupSize: '5 participants',
      level: 'Beginner to Advanced',
      price: 'LKR 35,000',
      instructor: 'Ravi Perera',
      rating: 4.7,
      description: 'Complete Node.js backend development including APIs, databases, and deployment strategies.',
      features: ['REST API development', 'Database integration', 'Authentication', 'Deployment'],
      schedule: [
        { date: '2024-09-20', time: '6:00 PM - 8:00 PM', available: true },
        { date: '2024-09-22', time: '6:00 PM - 8:00 PM', available: true },
        { date: '2024-09-25', time: '6:00 PM - 8:00 PM', available: true },
        { date: '2024-09-27', time: '6:00 PM - 8:00 PM', available: true },
      ]
    },
    
    // Soft Skills
    {
      id: 4,
      title: 'Effective Communication Skills',
      category: 'soft',
      skillType: 'interpersonal',
      targetSkill: 'Communication',
      type: 'one-on-one',
      duration: '4 sessions × 1 hour',
      groupSize: '1-on-1 mentoring',
      level: 'All levels',
      price: 'LKR 20,000',
      instructor: 'Dr. Sanduni Fernando',
      rating: 4.9,
      description: 'Personalized communication coaching to improve verbal, non-verbal, and written communication skills.',
      features: ['Personalized feedback', 'Public speaking practice', 'Body language training', 'Interview preparation'],
      schedule: [
        { date: '2024-09-05', time: '3:00 PM - 4:00 PM', available: true },
        { date: '2024-09-06', time: '10:00 AM - 11:00 AM', available: true },
        { date: '2024-09-07', time: '2:00 PM - 3:00 PM', available: false },
        { date: '2024-09-08', time: '4:00 PM - 5:00 PM', available: true },
      ]
    },
    {
      id: 5,
      title: 'Problem-Solving & Analytical Thinking',
      category: 'soft',
      skillType: 'analytical',
      targetSkill: 'Problem Solving',
      type: 'one-on-one',
      duration: '3 sessions × 1.5 hours',
      groupSize: '1-on-1 coaching',
      level: 'Intermediate to Advanced',
      price: 'LKR 18,000',
      instructor: 'Prof. Chamara Wijesinghe',
      rating: 4.8,
      description: 'Develop critical thinking and problem-solving methodologies for technical and business challenges.',
      features: ['Case study analysis', 'Logical reasoning', 'Decision-making frameworks', 'Creative thinking'],
      schedule: [
        { date: '2024-09-10', time: '11:00 AM - 12:30 PM', available: true },
        { date: '2024-09-12', time: '3:00 PM - 4:30 PM', available: true },
        { date: '2024-09-15', time: '10:00 AM - 11:30 AM', available: true },
        { date: '2024-09-17', time: '2:00 PM - 3:30 PM', available: false },
      ]
    },
    {
      id: 6,
      title: 'Leadership & Team Management',
      category: 'soft',
      skillType: 'management',
      targetSkill: 'Leadership',
      type: 'one-on-one',
      duration: '6 sessions × 1 hour',
      groupSize: '1-on-1 executive coaching',
      level: 'Advanced',
      price: 'LKR 45,000',
      instructor: 'Dilhan Rodrigo',
      rating: 5.0,
      description: 'Executive leadership coaching focusing on team management, strategic thinking, and organizational skills.',
      features: ['Leadership assessment', 'Team dynamics', 'Conflict resolution', 'Strategic planning'],
      schedule: [
        { date: '2024-09-20', time: '9:00 AM - 10:00 AM', available: true },
        { date: '2024-09-21', time: '4:00 PM - 5:00 PM', available: true },
        { date: '2024-09-23', time: '11:00 AM - 12:00 PM', available: true },
        { date: '2024-09-25', time: '3:00 PM - 4:00 PM', available: true },
      ]
    }
  ];

  // Filter training programs based on skills needing improvement
  const recommendedPrograms = trainingPrograms.filter(program =>
    skillsNeedingImprovement.some(skill => 
      skill.name === program.targetSkill || skill.type === program.skillType
    )
  );

  // Filter programs based on search and category
  const filteredPrograms = recommendedPrograms.filter(program => {
    const matchesCategory = selectedCategory === 'all' || program.category === selectedCategory;
    const matchesSearch = program.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         program.targetSkill.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const ScoreCard = ({ skill }) => {
    const getScoreColor = (score) => {
      if (score >= 80) return 'from-green-500 to-emerald-600';
      if (score >= 60) return 'from-yellow-500 to-orange-600';
      return 'from-red-500 to-pink-600';
    };

    const getScoreTextColor = (score) => {
      if (score >= 80) return 'text-green-800 bg-green-100';
      if (score >= 60) return 'text-yellow-800 bg-yellow-100';
      return 'text-red-800 bg-red-100';
    };

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">{skill.name}</h3>
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${getScoreTextColor(skill.score)}`}>
            {skill.score}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className={`h-2 rounded-full bg-gradient-to-r ${getScoreColor(skill.score)} transition-all duration-500`}
            style={{ width: `${skill.score}%` }}
          ></div>
        </div>
        {skill.score < 60 && (
          <div className="flex items-center text-red-600 text-sm mt-2">
            <AlertCircle className="w-4 h-4 mr-1" />
            Needs Improvement
          </div>
        )}
      </div>
    );
  };

  const TrainingCard = ({ program }) => {
    const isRecommended = skillsNeedingImprovement.some(skill => 
      skill.name === program.targetSkill
    );

    return (
      <div className={`bg-white rounded-2xl border-2 p-6 hover:shadow-xl transition-all duration-300 ${
        isRecommended ? 'border-purple-300 ring-2 ring-purple-100' : 'border-gray-200'
      }`}>
        {isRecommended && (
          <div className="flex items-center justify-center w-full mb-4">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center">
              <Target className="w-3 h-3 mr-1" />
              RECOMMENDED FOR YOU
            </div>
          </div>
        )}

        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{program.title}</h3>
            <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
              <div className="flex items-center">
                {program.type === 'group' ? (
                  <Users className="w-4 h-4 mr-1 text-blue-500" />
                ) : (
                  <User className="w-4 h-4 mr-1 text-green-500" />
                )}
                {program.groupSize}
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1 text-orange-500" />
                {program.duration}
              </div>
            </div>
            <div className="flex items-center space-x-2 mb-3">
              <div className="flex items-center">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="text-sm font-medium text-gray-700 ml-1">{program.rating}</span>
              </div>
              <span className="text-gray-300">•</span>
              <span className="text-sm text-gray-600">by {program.instructor}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-purple-600">{program.price}</div>
            <div className="text-sm text-gray-500">{program.level}</div>
          </div>
        </div>

        <p className="text-gray-600 mb-4 text-sm">{program.description}</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {program.features.slice(0, 4).map((feature, index) => (
            <div key={index} className="flex items-center text-xs text-gray-600">
              <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
              {feature}
            </div>
          ))}
        </div>

        <button
          onClick={() => setSelectedTraining(program)}
          className={`w-full font-semibold py-3 rounded-xl transition-all flex items-center justify-center ${
            program.type === 'group'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
              : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
          }`}
        >
          {program.type === 'group' ? 'Join Group Session' : 'Book 1-on-1 Session'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    );
  };

  const BookingModal = () => {
    if (!selectedTraining) return null;

    const availableSlots = selectedTraining.schedule.filter(slot => slot.available);

    const handleBooking = () => {
      if (selectedSlot) {
        // Handle booking logic here
        alert(`Booking confirmed for ${selectedTraining.title} on ${selectedSlot.date} at ${selectedSlot.time}`);
        setSelectedTraining(null);
        setBookingStep(0);
        setSelectedSlot(null);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">{selectedTraining.title}</h2>
              <button
                onClick={() => {
                  setSelectedTraining(null);
                  setBookingStep(0);
                  setSelectedSlot(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="flex items-center mt-2 space-x-4">
              {selectedTraining.type === 'group' ? (
                <div className="flex items-center text-blue-600">
                  <Users className="w-5 h-5 mr-2" />
                  Group Training (5 participants)
                </div>
              ) : (
                <div className="flex items-center text-green-600">
                  <User className="w-5 h-5 mr-2" />
                  One-on-One Training
                </div>
              )}
              <div className="text-2xl font-bold text-purple-600">{selectedTraining.price}</div>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Program Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Duration:</span>
                  <p className="text-gray-600">{selectedTraining.duration}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Instructor:</span>
                  <p className="text-gray-600">{selectedTraining.instructor}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Level:</span>
                  <p className="text-gray-600">{selectedTraining.level}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Rating:</span>
                  <p className="text-gray-600 flex items-center">
                    <Star className="w-4 h-4 text-yellow-400 fill-current mr-1" />
                    {selectedTraining.rating}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Select Your Preferred Time Slot</h3>
              <div className="grid grid-cols-1 gap-3">
                {availableSlots.map((slot, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedSlot(slot)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedSlot?.date === slot.date && selectedSlot?.time === slot.time
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{slot.date}</div>
                        <div className="text-sm text-gray-600">{slot.time}</div>
                      </div>
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span className="ml-1 text-sm">Available</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setSelectedTraining(null);
                  setSelectedSlot(null);
                }}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBooking}
                disabled={!selectedSlot}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
                  selectedSlot
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full mb-6">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Skill Enhancement Training</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Based on your interview performance, we've identified areas for improvement and curated personalized training programs
          </p>
        </div>

        {/* Overall Score */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r from-red-500 to-pink-600 text-white mb-4">
              <span className="text-2xl font-bold">{interviewResults.overallScore}%</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Overall Interview Score</h2>
            <p className="text-gray-600">Your performance indicates significant room for improvement in key areas</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {interviewResults.skills.map((skill, index) => (
              <ScoreCard key={index} skill={skill} />
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search training programs..."
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex bg-gray-100 rounded-xl p-1">
              {[
                { id: 'all', name: 'All Programs', count: recommendedPrograms.length },
                { id: 'technical', name: 'Technical Skills', count: recommendedPrograms.filter(p => p.category === 'technical').length },
                { id: 'soft', name: 'Soft Skills', count: recommendedPrograms.filter(p => p.category === 'soft').length }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    selectedCategory === tab.id
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.name}
                  <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Training Programs */}
        {skillsNeedingImprovement.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {filteredPrograms.map((program) => (
              <TrainingCard key={program.id} program={program} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full flex items-center justify-center">
              <Award className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Excellent Performance!</h3>
            <p className="text-gray-600 mb-6">All your skills scored above 60%. No additional training required at this time.</p>
          </div>
        )}

        {filteredPrograms.length === 0 && skillsNeedingImprovement.length > 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
              <Search className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No matching programs found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your search terms or browse all categories</p>
            <button 
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
              }}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Show All Programs
            </button>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Skills Needing Improvement</p>
                <p className="text-3xl font-bold">{skillsNeedingImprovement.length}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-blue-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100">Available Programs</p>
                <p className="text-3xl font-bold">{recommendedPrograms.length}</p>
              </div>
              <BookOpen className="w-8 h-8 text-green-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">Training Formats</p>
                <p className="text-3xl font-bold">2</p>
                <p className="text-xs text-purple-100">Group & 1-on-1</p>
              </div>
              <Users className="w-8 h-8 text-purple-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <BookingModal />
    </div>
  );
};

export default TrainingPage;