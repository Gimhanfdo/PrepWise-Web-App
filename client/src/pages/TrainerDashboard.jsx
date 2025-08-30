import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Phone, MapPin, GraduationCap, BookOpen, Calendar, 
  Clock, Users, Award, Edit, Plus, Eye, Trash2, Filter, Search,
  Star, TrendingUp, BarChart3, Settings, Bell, ChevronRight,
  Video, FileText, Globe, Target, Zap, Building
} from 'lucide-react';
import NavBar from "../components/NavBar";
import { useNavigate } from "react-router-dom";

const TrainerDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [loading, setLoading] = useState(false);

  // Sample trainer data
  const trainerData = {
    personalDetails: {
      name: "Dr. Sarah Johnson",
      email: "sarah.johnson@techtrainer.com",
      phone: "+94 77 123 4567",
      address: "123 Galle Road, Colombo 03, Sri Lanka",
      profileImage: "/api/placeholder/150/150",
      bio: "Passionate technology trainer with over 8 years of experience in software development and corporate training. Specializes in modern web technologies, AI/ML, and agile methodologies.",
      joinDate: "January 2020",
      rating: 4.8,
      totalStudents: 2847,
      totalHours: 1250
    },
    education: [
      {
        id: 1,
        degree: "Ph.D. in Computer Science",
        institution: "University of Colombo",
        year: "2018",
        specialization: "Artificial Intelligence & Machine Learning"
      },
      {
        id: 2,
        degree: "Master of Science in Software Engineering",
        institution: "University of Moratuwa",
        year: "2014",
        specialization: "Full Stack Development"
      },
      {
        id: 3,
        degree: "Bachelor of Science in Computer Science",
        institution: "SLIIT",
        year: "2012",
        specialization: "Software Development"
      }
    ],
    certifications: [
      "AWS Certified Solutions Architect",
      "Google Cloud Professional",
      "Certified Scrum Master",
      "React Native Certified Developer"
    ],
    trainingPrograms: [
      {
        id: 1,
        title: "Full Stack Web Development Bootcamp",
        category: "Web Development",
        duration: "12 weeks",
        students: 245,
        rating: 4.9,
        price: "LKR 75,000",
        status: "active",
        startDate: "2024-09-01",
        description: "Complete web development course covering React, Node.js, and databases.",
        mode: "hybrid"
      },
      {
        id: 2,
        title: "AI & Machine Learning Fundamentals",
        category: "Artificial Intelligence",
        duration: "8 weeks",
        students: 189,
        rating: 4.8,
        price: "LKR 65,000",
        status: "active",
        startDate: "2024-08-15",
        description: "Introduction to AI concepts, Python for ML, and practical projects.",
        mode: "online"
      },
      {
        id: 3,
        title: "Mobile App Development with React Native",
        category: "Mobile Development",
        duration: "10 weeks",
        students: 156,
        rating: 4.7,
        price: "LKR 55,000",
        status: "completed",
        startDate: "2024-06-01",
        description: "Build cross-platform mobile apps using React Native framework.",
        mode: "in-person"
      },
      {
        id: 4,
        title: "DevOps & Cloud Computing",
        category: "Cloud Computing",
        duration: "6 weeks",
        students: 98,
        rating: 4.6,
        price: "LKR 45,000",
        status: "upcoming",
        startDate: "2024-10-01",
        description: "Learn Docker, Kubernetes, AWS, and CI/CD practices.",
        mode: "hybrid"
      }
    ]
  };

  const categories = [
    { id: 'all', name: 'All Categories', count: trainerData.trainingPrograms.length },
    { id: 'Web Development', name: 'Web Development', count: 1 },
    { id: 'Artificial Intelligence', name: 'AI & ML', count: 1 },
    { id: 'Mobile Development', name: 'Mobile Dev', count: 1 },
    { id: 'Cloud Computing', name: 'Cloud', count: 1 }
  ];

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'education', name: 'Education', icon: GraduationCap },
    { id: 'programs', name: 'Training Programs', icon: BookOpen },
    { id: 'settings', name: 'Settings', icon: Settings }
  ];

  const filterPrograms = () => {
    let filtered = trainerData.trainingPrograms;
    
    if (filterCategory !== 'all') {
      filtered = filtered.filter(program => program.category === filterCategory);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(program => 
        program.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        program.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'online': return <Globe className="w-4 h-4" />;
      case 'in-person': return <Building className="w-4 h-4" />;
      case 'hybrid': return <Video className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  // Overview Tab Content
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Total Students</p>
              <p className="text-2xl font-bold">{trainerData.personalDetails.totalStudents.toLocaleString()}</p>
            </div>
            <Users className="w-8 h-8 text-blue-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-500 to-teal-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Training Hours</p>
              <p className="text-2xl font-bold">{trainerData.personalDetails.totalHours.toLocaleString()}</p>
            </div>
            <Clock className="w-8 h-8 text-green-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Active Programs</p>
              <p className="text-2xl font-bold">{trainerData.trainingPrograms.filter(p => p.status === 'active').length}</p>
            </div>
            <BookOpen className="w-8 h-8 text-purple-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">Avg Rating</p>
              <p className="text-2xl font-bold">{trainerData.personalDetails.rating}</p>
            </div>
            <Star className="w-8 h-8 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Recent Programs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Training Programs</h3>
          <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">View All</button>
        </div>
        <div className="space-y-4">
          {trainerData.trainingPrograms.slice(0, 3).map((program) => (
            <div key={program.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  {getModeIcon(program.mode)}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{program.title}</h4>
                  <p className="text-sm text-gray-600">{program.students} students • {program.duration}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(program.status)}`}>
                  {program.status}
                </span>
                <div className="flex items-center text-yellow-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="ml-1 text-sm font-medium">{program.rating}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Profile Tab Content
  const ProfileTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Personal Details</h3>
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </button>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-shrink-0">
            <img 
              src={trainerData.personalDetails.profileImage} 
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover border-4 border-gray-100"
            />
          </div>
          
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Full Name</p>
                  <p className="font-medium text-gray-900">{trainerData.personalDetails.name}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium text-gray-900">{trainerData.personalDetails.email}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Contact</p>
                  <p className="font-medium text-gray-900">{trainerData.personalDetails.phone}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Join Date</p>
                  <p className="font-medium text-gray-900">{trainerData.personalDetails.joinDate}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Address</p>
                <p className="font-medium text-gray-900">{trainerData.personalDetails.address}</p>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 mb-2">Bio</p>
              <p className="text-gray-900">{trainerData.personalDetails.bio}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Education Tab Content
  const EducationTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Educational Background</h3>
          <button className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Plus className="w-4 h-4 mr-2" />
            Add Education
          </button>
        </div>
        
        <div className="space-y-4">
          {trainerData.education.map((edu) => (
            <div key={edu.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="p-2 bg-blue-100 rounded-lg">
                <GraduationCap className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{edu.degree}</h4>
                <p className="text-gray-700">{edu.institution}</p>
                <p className="text-sm text-gray-600">{edu.specialization}</p>
                <p className="text-sm text-gray-500">{edu.year}</p>
              </div>
              <div className="flex space-x-2">
                <button className="p-2 text-gray-400 hover:text-blue-600">
                  <Edit className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Certifications</h3>
          <button className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            <Plus className="w-4 h-4 mr-2" />
            Add Certification
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trainerData.certifications.map((cert, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
              <Award className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-gray-900">{cert}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Programs Tab Content
  const ProgramsTab = () => (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search programs..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.count})
                </option>
              ))}
            </select>
            
            <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4 mr-2" />
              New Program
            </button>
          </div>
        </div>
      </div>

      {/* Programs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filterPrograms().map((program) => (
          <div key={program.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  {getModeIcon(program.mode)}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{program.title}</h4>
                  <p className="text-sm text-gray-600">{program.category}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(program.status)}`}>
                {program.status}
              </span>
            </div>

            <p className="text-gray-600 mb-4 text-sm">{program.description}</p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">{program.duration}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">{program.students} students</span>
              </div>
              <div className="flex items-center space-x-2">
                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                <span className="text-sm text-gray-600">{program.rating} rating</span>
              </div>
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">{program.price}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="text-sm text-gray-600">
                Start: {new Date(program.startDate).toLocaleDateString()}
              </div>
              <div className="flex space-x-2">
                <button className="p-2 text-gray-400 hover:text-blue-600">
                  <Eye className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-green-600">
                  <Edit className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filterPrograms().length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No programs found</h3>
          <p className="text-gray-600">Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );

  // Settings Tab Content
  const SettingsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Account Settings</h3>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Notifications</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" defaultChecked />
                <span className="ml-3 text-sm text-gray-700">New student enrollments</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" defaultChecked />
                <span className="ml-3 text-sm text-gray-700">Program completion alerts</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="ml-3 text-sm text-gray-700">Marketing updates</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Privacy Settings</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" defaultChecked />
                <span className="ml-3 text-sm text-gray-700">Show profile to students</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" defaultChecked />
                <span className="ml-3 text-sm text-gray-700">Allow reviews and ratings</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab />;
      case 'profile': return <ProfileTab />;
      case 'education': return <EducationTab />;
      case 'programs': return <ProgramsTab />;
      case 'settings': return <SettingsTab />;
      default: return <OverviewTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div className="flex items-center space-x-4 mb-4 lg:mb-0">
            <img 
              src={trainerData.personalDetails.profileImage} 
              alt="Profile"
              className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-lg"
            />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Welcome back, {trainerData.personalDetails.name.split(' ')[0]}</h1>
              <p className="text-gray-600">Manage your training programs and track your progress</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button className="p-2 text-gray-400 hover:text-gray-600 relative">
              <Bell className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            </button>
            <button className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all">
              <Plus className="w-4 h-4 mr-2" />
              Quick Action
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 p-2 mb-8">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-4 py-3 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>
    </div>
  );
};

export default TrainerDashboard;