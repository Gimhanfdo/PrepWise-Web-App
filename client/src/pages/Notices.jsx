import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, MapPin, Users, ExternalLink, Clock, BookOpen, Trophy,Zap,Globe,Building,ChevronRight, Bell,TrendingUp,Code,Laptop,Award } from 'lucide-react';
import NavBar from "../components/NavBar";
import { useNavigate } from "react-router-dom";

const NoticesPage = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [notices, setNotices] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // NewsAPI configuration - Temporary hardcoded for testing
  // Replace 'your_api_key_here' with your actual NewsAPI key for testing
const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY;
const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

  // Fallback sample notices data for when NewsAPI is not available
  const fallbackNotices = [
    {
      id: 1,
      title: "Sri Lanka's AI Revolution: New Government Initiative Launched",
      summary: "Government announces $50M investment in AI research and development across universities.",
      source: "Ministry of Technology",
      type: "government",
      priority: "high",
      time: "2 hours ago",
      tags: ["AI", "Government", "Funding"],
      url: "#",
      imageUrl: null
    },
    {
      id: 2,
      title: "Dialog Axiata Launches 5G Network Nationwide",
      summary: "Complete 5G coverage now available across Colombo, with expansion to other provinces.",
      source: "Dialog Axiata",
      type: "industry",
      priority: "medium",
      time: "5 hours ago",
      tags: ["5G", "Telecommunications", "Infrastructure"],
      url: "#",
      imageUrl: null
    },
    {
      id: 3,
      title: "University of Colombo Opens New Computer Science Department",
      summary: "State-of-the-art facilities with focus on AI, blockchain, and cybersecurity research.",
      source: "University of Colombo",
      type: "education",
      priority: "medium",
      time: "1 day ago",
      tags: ["Education", "Computer Science", "Research"],
      url: "#",
      imageUrl: null
    },
    {
      id: 4,
      title: "Microsoft Azure Data Center Coming to Sri Lanka",
      summary: "First cloud data center facility to be established in Colombo by 2025.",
      source: "Microsoft",
      type: "industry",
      priority: "high",
      time: "2 days ago",
      tags: ["Cloud Computing", "Infrastructure", "Microsoft"],
      url: "#",
      imageUrl: null
    }
  ];

  // Keep some sample events data since NewsAPI doesn't provide event data
  const sampleEvents = [
    {
      id: 1,
      title: "Sri Lanka Tech Summit 2024",
      organizer: "SLASSCOM",
      type: "conference",
      mode: "hybrid",
      date: "2024-09-15",
      endDate: "2024-09-17",
      time: "9:00 AM - 6:00 PM",
      location: "Shangri-La Hotel, Colombo",
      participants: "500+",
      fee: "LKR 15,000",
      description: "Annual technology summit featuring AI, blockchain, and startup ecosystem.",
      tags: ["AI", "Blockchain", "Startups"],
      registrationUrl: "#",
      featured: true
    },
    {
      id: 2,
      title: "Hackathon Sri Lanka 2024",
      organizer: "University of Moratuwa",
      type: "hackathon",
      mode: "in-person",
      date: "2024-09-01",
      endDate: "2024-09-02",
      time: "48 hours",
      location: "University of Moratuwa",
      participants: "200+",
      fee: "Free",
      description: "48-hour coding competition focusing on solutions for smart cities.",
      tags: ["Coding", "Smart Cities", "Competition"],
      registrationUrl: "#",
      featured: false
    },
    {
      id: 3,
      title: "AI/ML Workshop Series",
      organizer: "APIIT Sri Lanka",
      type: "workshop",
      mode: "virtual",
      date: "2024-08-30",
      time: "2:00 PM - 5:00 PM",
      location: "Online",
      participants: "100",
      fee: "Free",
      description: "Hands-on workshop covering machine learning fundamentals and practical applications.",
      tags: ["Machine Learning", "AI", "Workshop"],
      registrationUrl: "#",
      featured: false
    }
  ];

  // Function to fetch news from NewsAPI
  // Simple and effective method - Replace your current fetchTechNews function with this
const fetchTechNews = async () => {
  // Check if NewsAPI key is available
  if (!NEWS_API_KEY) {
    console.warn('NewsAPI key not found. Using fallback data. Add VITE_NEWS_API_KEY to your .env file for live data.');
    return fallbackNotices;
  }

  try {
    // Use the technology category endpoint - this is the most reliable method
    const response = await fetch(
      `${NEWS_API_BASE_URL}/top-headlines?category=technology&language=en&pageSize=20&apiKey=${NEWS_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const articles = data.articles || [];

    // Transform NewsAPI data to match your component's structure
    const transformedNotices = articles.map((article, index) => ({
      id: index + 1,
      title: article.title,
      summary: article.description || 'No description available',
      source: article.source.name,
      type: getNoticeType(article.source.name),
      priority: getPriority(article.title, article.description),
      time: getTimeAgo(article.publishedAt),
      tags: extractTags(article.title, article.description),
      url: article.url,
      imageUrl: article.urlToImage
    }));

    return transformedNotices.length > 0 ? transformedNotices : fallbackNotices;

  } catch (error) {
    console.error('Error fetching tech news:', error);
    console.warn('Falling back to sample data');
    return fallbackNotices;
  }
};

  // Helper function to determine notice type based on source
  const getNoticeType = (sourceName) => {
    const governmentSources = ['BBC', 'Reuters', 'Associated Press'];
    const industrySources = ['TechCrunch', 'Wired', 'The Verge', 'Ars Technica'];
    const educationSources = ['MIT Technology Review', 'IEEE Spectrum'];

    if (governmentSources.some(source => sourceName.includes(source))) {
      return 'government';
    } else if (industrySources.some(source => sourceName.includes(source))) {
      return 'industry';
    } else if (educationSources.some(source => sourceName.includes(source))) {
      return 'education';
    }
    return 'industry'; // default
  };

  // Helper function to determine priority based on content
  const getPriority = (title, description) => {
    const highPriorityKeywords = ['breaking', 'urgent', 'major', 'critical', 'launch', 'announce'];
    const mediumPriorityKeywords = ['new', 'update', 'release', 'introduces'];
    
    const content = `${title} ${description}`.toLowerCase();
    
    if (highPriorityKeywords.some(keyword => content.includes(keyword))) {
      return 'high';
    } else if (mediumPriorityKeywords.some(keyword => content.includes(keyword))) {
      return 'medium';
    }
    return 'low';
  };

  // Helper function to get time ago from published date
  const getTimeAgo = (publishedAt) => {
    const now = new Date();
    const published = new Date(publishedAt);
    const diffInHours = Math.floor((now - published) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Less than an hour ago';
    } else if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} days ago`;
    }
  };

  // Helper function to extract tags from title and description
  const extractTags = (title, description) => {
    const content = `${title} ${description}`.toLowerCase();
    const possibleTags = [
      'AI', 'Machine Learning', 'Blockchain', 'Cryptocurrency', 'Cloud Computing',
      'Cybersecurity', 'Mobile', 'Web Development', 'Data Science', 'IoT',
      'Startup', 'Funding', 'Innovation', 'Research', 'Software', 'Hardware',
      '5G', 'VR', 'AR', 'Quantum Computing', 'Robotics'
    ];
    
    return possibleTags.filter(tag => 
      content.includes(tag.toLowerCase()) || 
      content.includes(tag.toLowerCase().replace(' ', ''))
    ).slice(0, 3); // Limit to 3 tags
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('Loading data...');
        
        // Fetch news data (with fallback)
        const newsData = await fetchTechNews();
        console.log('News data loaded:', newsData.length, 'items');
        setNotices(newsData);
        
        // Set events data (keeping sample data for now)
        setEvents(sampleEvents);
        console.log('Events data loaded:', sampleEvents.length, 'items');
        
      } catch (error) {
        console.error('Error loading data:', error);
        // Even if there's an error, use fallback data
        setNotices(fallbackNotices);
        setEvents(sampleEvents);
      } finally {
        setLoading(false);
        console.log('Data loading complete');
      }
    };

    loadData();
  }, []);

  const tabs = [
    { id: 'all', name: 'All Updates', icon: Globe, count: notices.length + events.length },
    { id: 'notices', name: 'Tech Notices', icon: Bell, count: notices.length },
    { id: 'events', name: 'Events', icon: Calendar, count: events.length }
  ];

  const filterData = () => {
    let allData = [];
    
    if (activeTab === 'all' || activeTab === 'notices') {
      allData = [...allData, ...notices.map(item => ({...item, category: 'notice'}))];
    }
    if (activeTab === 'all' || activeTab === 'events') {
      allData = [...allData, ...events.map(item => ({...item, category: 'event'}))];
    }

    if (searchTerm) {
      allData = allData.filter(item => 
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.organizer && item.organizer.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.source && item.source.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
      );
    }

    return allData;
  };

  const NoticeCard = ({ notice }) => {
    const priorityColors = {
      high: 'from-red-500 to-pink-600',
      medium: 'from-yellow-500 to-orange-600',
      low: 'from-green-500 to-teal-600'
    };

    const typeIcons = {
      government: <Building className="w-4 h-4" />,
      industry: <TrendingUp className="w-4 h-4" />,
      education: <BookOpen className="w-4 h-4" />
    };

    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
        {notice.imageUrl && (
          <div className="mb-4">
            <img 
              src={notice.imageUrl} 
              alt={notice.title}
              className="w-full h-32 object-cover rounded-lg"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}
        
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-lg bg-gradient-to-r ${priorityColors[notice.priority]} text-white`}>
              {typeIcons[notice.type]}
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900">{notice.source}</span>
              <div className="flex items-center text-xs text-gray-500 mt-1">
                <Clock className="w-3 h-3 mr-1" />
                {notice.time}
              </div>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            notice.priority === 'high' ? 'bg-red-100 text-red-800' :
            notice.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }`}>
            {notice.priority.toUpperCase()}
          </span>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">{notice.title}</h3>
        <p className="text-gray-600 mb-4 line-clamp-3">{notice.summary}</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {notice.tags.map((tag, index) => (
            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">
              {tag}
            </span>
          ))}
        </div>

        <a 
          href={notice.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center text-purple-600 hover:text-purple-800 font-medium text-sm transition-colors"
        >
          Read Full Article <ChevronRight className="w-4 h-4 ml-1" />
        </a>
      </div>
    );
  };

  const EventCard = ({ event }) => {
    const typeGradients = {
      conference: 'from-purple-500 to-indigo-600',
      hackathon: 'from-green-500 to-teal-600',
      workshop: 'from-blue-500 to-cyan-600',
      competition: 'from-orange-500 to-red-600'
    };

    const typeIcons = {
      conference: <Users className="w-5 h-5" />,
      hackathon: <Code className="w-5 h-5" />,
      workshop: <Laptop className="w-5 h-5" />,
      competition: <Trophy className="w-5 h-5" />
    };

    return (
      <div className={`rounded-2xl p-6 text-white relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${
        event.featured ? 'bg-gradient-to-br from-purple-600 to-indigo-700' : `bg-gradient-to-br ${typeGradients[event.type]}`
      }`}>
        {event.featured && (
          <div className="absolute top-4 right-4">
            <div className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold">
              FEATURED
            </div>
          </div>
        )}

        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              {typeIcons[event.type]}
            </div>
            <div>
              <h3 className="text-xl font-bold">{event.title}</h3>
              <p className="text-white/80 text-sm">{event.organizer}</p>
            </div>
          </div>
        </div>

        <p className="text-white/90 mb-4 text-sm">{event.description}</p>

        <div className="space-y-3 mb-4">
          <div className="flex items-center text-white/80 text-sm">
            <Calendar className="w-4 h-4 mr-2" />
            {event.date} {event.endDate && `- ${event.endDate}`}
          </div>
          <div className="flex items-center text-white/80 text-sm">
            <Clock className="w-4 h-4 mr-2" />
            {event.time}
          </div>
          <div className="flex items-center text-white/80 text-sm">
            <MapPin className="w-4 h-4 mr-2" />
            {event.location} • {event.mode}
          </div>
          <div className="flex items-center justify-between text-white/80 text-sm">
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-2" />
              {event.participants} participants
            </div>
            <div className="font-semibold">
              {event.fee}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {event.tags.map((tag, index) => (
            <span key={index} className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded-lg text-xs font-medium">
              {tag}
            </span>
          ))}
        </div>

        <button className="w-full bg-white text-gray-900 font-semibold py-3 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center">
          Register Now <ExternalLink className="w-4 h-4 ml-2" />
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading latest updates...</p>
        </div>
      </div>
    );
  }

  if (error && notices.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load News</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full mb-6">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Tech Industry Updates</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Stay ahead with the latest tech notices, events, and opportunities in Sri Lanka
          </p>
        </div>

        {/* Search and Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search updates, events, or organizations..."
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      activeTab === tab.id
                        ? 'bg-white text-purple-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.name}
                    <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filterData().map((item) => (
            item.category === 'notice' ? (
              <NoticeCard key={`notice-${item.id}`} notice={item} />
            ) : (
              <EventCard key={`event-${item.id}`} event={item} />
            )
          ))}
        </div>

        {/* Empty State */}
        {filterData().length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-purple-100 to-indigo-100 rounded-full flex items-center justify-center">
              <Search className="w-10 h-10 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No updates found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your search terms or browse all categories</p>
            <button 
              onClick={() => {
                setSearchTerm('');
                setActiveTab('all');
              }}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Show All Updates
            </button>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">Total Notices</p>
                <p className="text-2xl font-bold">{notices.length}</p>
              </div>
              <Bell className="w-8 h-8 text-purple-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-green-500 to-teal-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100">Upcoming Events</p>
                <p className="text-2xl font-bold">{events.filter(e => new Date(e.date) > new Date()).length}</p>
              </div>
              <Calendar className="w-8 h-8 text-green-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100">Featured Events</p>
                <p className="text-2xl font-bold">{events.filter(e => e.featured).length}</p>
              </div>
              <Award className="w-8 h-8 text-orange-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoticesPage;