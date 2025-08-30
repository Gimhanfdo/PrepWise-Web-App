import React, { useState, useEffect } from 'react';
import { Search, Edit, Trash2, Eye, UserPlus, Bell, Calendar, Award } from 'lucide-react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('freshers');
  const [freshers, setFreshers] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({});

  // Fetch data
  useEffect(() => {
    fetchFreshers();
    fetchTrainers();
    fetchNotices();
  }, []);

  const fetchFreshers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/freshers');
      const data = await res.json();
      setFreshers(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchTrainers = async () => {
    try {
      const res = await fetch('/api/admin/trainers');
      const data = await res.json();
      setTrainers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotices = async () => {
    try {
      const res = await fetch('/api/admin/notices');
      const data = await res.json();
      const mappedData = data.map(n => ({ ...n, _id: n._id || n.noticeId }));
      setNotices(mappedData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateUser = async (id, data, type) => {
    try {
      const res = await fetch(`/api/admin/${type}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        type === 'freshers' ? fetchFreshers() : fetchTrainers();
        setShowModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeactivateUser = async (id, type) => {
    try {
      const res = await fetch(`/api/admin/${type}/${id}/deactivate`, { method: 'PUT' });
      if (res.ok) type === 'freshers' ? fetchFreshers() : fetchTrainers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNotice = async (data) => {
    try {
      const res = await fetch('/api/admin/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        fetchNotices();
        setShowModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateNotice = async (id, data) => {
    try {
      const res = await fetch(`/api/admin/notices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        fetchNotices();
        setShowModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNotice = async (id) => {
    try {
      const res = await fetch(`/api/admin/notices/${id}`, { method: 'DELETE' });
      if (res.ok) fetchNotices();
    } catch (err) {
      console.error(err);
    }
  };

  const openModal = (type, user = null) => {
    setModalType(type);
    setSelectedUser(user);
    setFormData(user ? { ...user } : {});
    setShowModal(true);
  };

  const filteredFreshers = freshers.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredTrainers = trainers.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        activeTab === id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  // ---------- Modal Component ----------
  const Modal = () => {
    if (!showModal) return null;

    const handleChange = (e) => {
      const { name, value, type, checked } = e.target;
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      if (modalType === 'addNotice') handleAddNotice(formData);
      if (modalType === 'editNotice') handleUpdateNotice(formData._id, formData);
      if (modalType === 'editFresher') handleUpdateUser(formData._id, formData, 'freshers');
      if (modalType === 'editTrainer') handleUpdateUser(formData._id, formData, 'trainers');
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {modalType === 'addNotice' && 'Add Event Notice'}
              {modalType === 'editNotice' && 'Edit Event Notice'}
              {modalType === 'editFresher' && 'Edit Fresher'}
              {modalType === 'editTrainer' && 'Edit Trainer'}
              {modalType === 'viewFresher' && 'Fresher Profile'}
              {modalType === 'viewTrainer' && 'Trainer Profile'}
            </h3>
            <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
          </div>

          {(modalType === 'addNotice' || modalType === 'editNotice') && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Event Name</label>
                <input
                  type="text"
                  name="eventName"
                  value={formData.eventName || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Description</label>
                <textarea
                  name="eventDescription"
                  value={formData.eventDescription || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  rows="3"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date ? new Date(formData.date).toISOString().slice(0,10) : ''}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Time</label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">Venue</label>
                <input
                  type="text"
                  name="venue"
                  value={formData.venue || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Registration Link</label>
                <input
                  type="url"
                  name="registrationLink"
                  value={formData.registrationLink || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  placeholder="https://example.com/register"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Other Info</label>
                <textarea
                  name="otherInfo"
                  value={formData.otherInfo || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  rows="2"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-200 rounded-md">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">{modalType.includes('add') ? 'Add' : 'Update'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  // ---------- Render Tabs ----------
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="text-sm text-gray-500">
            Freshers: {freshers.length} | Active Trainers: {trainers.filter(t => t.isActive).length}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex space-x-2 mb-6">
          <TabButton id="freshers" label="Manage Freshers" icon={UserPlus} />
          <TabButton id="trainers" label="Manage Trainers" icon={Award} />
          <TabButton id="notices" label="Event Notices" icon={Bell} />
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'freshers' && (
              <div className="grid gap-4">
                {filteredFreshers.map(fresher => (
                  <div key={fresher._id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">{fresher.name[0]}</div>
                      <div>
                        <div className="font-medium">{fresher.name}</div>
                        <div className="text-gray-500 text-sm">{fresher.email}</div>
                      </div>
                    </div>
                    <div className="space-x-2">
                      <button onClick={() => openModal('editFresher', fresher)} className="text-green-600"><Edit size={16} /></button>
                      <button onClick={() => handleDeactivateUser(fresher._id, 'freshers')} className="text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'trainers' && (
              <div className="grid gap-4">
                {filteredTrainers.map(trainer => (
                  <div key={trainer._id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-white font-medium">{trainer.name[0]}</div>
                      <div>
                        <div className="font-medium">{trainer.name}</div>
                        <div className="text-gray-500 text-sm">{trainer.email}</div>
                      </div>
                    </div>
                    <div className="space-x-2">
                      <button onClick={() => openModal('editTrainer', trainer)} className="text-green-600"><Edit size={16} /></button>
                      <button onClick={() => handleDeactivateUser(trainer._id, 'trainers')} className="text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'notices' && (
              <div className="grid gap-4">
                <button onClick={() => openModal('addNotice')} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center space-x-2">
                  <Bell size={20} /> Add Event
                </button>
                {notices.map(notice => (
                  <div key={notice._id} className="bg-white rounded-lg shadow p-4 flex justify-between items-start">
                    <div>
                      <div className="font-medium">{notice.eventName}</div>
                      <div className="text-gray-500 text-sm">{notice.eventDescription}</div>
                      <div className="text-gray-400 text-xs mt-1">Date: {new Date(notice.date).toLocaleDateString()} Time: {notice.time}</div>
                    </div>
                    <div className="space-x-2">
                      <button onClick={() => openModal('editNotice', notice)} className="text-blue-600"><Edit size={16} /></button>
                      <button onClick={() => handleDeleteNotice(notice._id)} className="text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal />
    </div>
  );
};

export default AdminDashboard;





// import React, { useState, useEffect } from 'react';
// import { Search, Edit, Trash2, Eye, UserPlus, Bell, Calendar, Award, AlertTriangle } from 'lucide-react';

// const AdminDashboard = () => {
//   const [activeTab, setActiveTab] = useState('freshers');
//   const [freshers, setFreshers] = useState([]);
//   const [trainers, setTrainers] = useState([]);
//   const [notices, setNotices] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [showModal, setShowModal] = useState(false);
//   const [modalType, setModalType] = useState('');
//   const [selectedUser, setSelectedUser] = useState(null);
//   const [formData, setFormData] = useState({});

//   // Fetch data on component mount
//   useEffect(() => {
//     fetchFreshers();
//     fetchTrainers();
//     fetchNotices();
//   }, []);

//   const fetchFreshers = async () => {
//     setLoading(true);
//     try {
//       const response = await fetch('/api/admin/freshers');
//       const data = await response.json();
//       setFreshers(data);
//     } catch (error) {
//       console.error('Error fetching freshers:', error);
//     }
//     setLoading(false);
//   };

//   const fetchTrainers = async () => {
//     try {
//       const response = await fetch('/api/admin/trainers');
//       const data = await response.json();
//       setTrainers(data);
//     } catch (error) {
//       console.error('Error fetching trainers:', error);
//     }
//   };

//   const fetchNotices = async () => {
//   try {
//     const response = await fetch('/api/admin/notices');
//     const data = await response.json();

//     // Map noticeId to _id so frontend can use it consistently
//     const mappedData = data.map(notice => ({
//       ...notice,
//       _id: notice._id || notice.noticeId, // fallback to noticeId if _id not present
//     }));

//     setNotices(mappedData);
//   } catch (error) {
//     console.error('Error fetching notices:', error);
//   }
// };


//   const handleUpdateUser = async (userId, userData, userType) => {
//     try {
//       const response = await fetch(`/api/admin/${userType}/${userId}`, {
//         method: 'PUT',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(userData)
//       });
//       if (response.ok) {
//         if (userType === 'freshers') fetchFreshers();
//         else fetchTrainers();
//         setShowModal(false);
//       }
//     } catch (error) {
//       console.error('Error updating user:', error);
//     }
//   };

//   const handleDeactivateUser = async (userId, userType) => {
//     try {
//       const response = await fetch(`/api/admin/${userType}/${userId}/deactivate`, {
//         method: 'PUT'
//       });
//       if (response.ok) {
//         if (userType === 'freshers') fetchFreshers();
//         else fetchTrainers();
//       }
//     } catch (error) {
//       console.error('Error deactivating user:', error);
//     }
//   };

//   //for notices
//   const handleAddNotice = async (noticeData) => {
//     try {
//       const response = await fetch('/api/admin/notices', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(noticeData)
//       });
//       if (response.ok) {
//         fetchNotices();
//         setShowModal(false);
//       }
//     } catch (error) {
//       console.error('Error adding notice:', error);
//     }
//   };

//   const handleDeleteNotice = async (noticeId) => {
//   try {
//     const response = await fetch(`/api/admin/notices/${noticeId}`, {
//       method: 'DELETE',
//     });

//     if (response.ok) {
//       // Refresh the notices list after deletion
//       fetchNotices();
//       alert('Notice deleted successfully');
//     } else {
//       const data = await response.json();
//       alert(data.error || 'Failed to delete notice');
//     }
//   } catch (error) {
//     console.error('Error deleting notice:', error);
//     alert('Something went wrong');
//   }
// };

// const handleUpdateNotice = async (noticeId, updatedData) => {
//   try {
//     const response = await fetch(`/api/admin/notices/${noticeId}`, {
//       method: 'PUT',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(updatedData),
//     });

//     const data = await response.json();

//     if (response.ok) {
//       alert('Notice updated successfully!');
//       fetchNotices(); // Refresh the list after update
//       setShowModal(false); // Close modal
//       setFormData({}); // Reset form
//     } else {
//       alert(data.error || 'Failed to update notice');
//     }
//   } catch (error) {
//     console.error('Error updating notice:', error);
//     alert('Something went wrong');
//   }
// };

//   const openModal = (type, notice = null) => {
//   setModalType(type);
//   setSelectedUser(notice); // you can ignore if not needed
//   if (notice && type === 'editNotice') {
//     setFormData({
//       _id: notice._id,
//       eventName: notice.eventName,
//       eventDescription: notice.eventDescription,
//       date: notice.date ? new Date(notice.date).toISOString().slice(0,16) : '',
//       time: notice.time,
//       venue: notice.venue,
//       registrationLink: notice.registrationLink,
//       otherInfo: notice.otherInfo,
//       priority: notice.priority || 'medium'
//     });
//   } else {
//     setFormData({});
//   }
//   setShowModal(true);

//   {modalType === 'editNotice' && (
//   <form onSubmit={(e) => {
//       e.preventDefault();
//       handleUpdateNotice(formData._id, formData);
//   }} className="space-y-4">
//     <div>
//       <label>Event Name</label>
//       <input
//         type="text"
//         value={formData.eventName || ''}
//         onChange={(e) => setFormData({...formData, eventName: e.target.value})}
//         required
//       />
//     </div>
//     <div>
//       <label>Description</label>
//       <textarea
//         value={formData.eventDescription || ''}
//         onChange={(e) => setFormData({...formData, eventDescription: e.target.value})}
//         required
//       />
//     </div>
//     <div>
//       <label>Date & Time</label>
//       <input
//         type="datetime-local"
//         value={formData.date || ''}
//         onChange={(e) => setFormData({...formData, date: e.target.value})}
//         required
//       />
//     </div>
//     <div>
//       <label>Venue</label>
//       <input
//         type="text"
//         value={formData.venue || ''}
//         onChange={(e) => setFormData({...formData, venue: e.target.value})}
//         required
//       />
//     </div>
//     <div>
//       <label>Registration Link</label>
//       <input
//         type="url"
//         value={formData.registrationLink || ''}
//         onChange={(e) => setFormData({...formData, registrationLink: e.target.value})}
//       />
//     </div>
//     <div>
//       <label>Other Info</label>
//       <input
//         type="text"
//         value={formData.otherInfo || ''}
//         onChange={(e) => setFormData({...formData, otherInfo: e.target.value})}
//       />
//     </div>
//     <div>
//       <label>Priority</label>
//       <select
//         value={formData.priority || 'medium'}
//         onChange={(e) => setFormData({...formData, priority: e.target.value})}
//       >
//         <option value="low">Low</option>
//         <option value="medium">Medium</option>
//         <option value="high">High</option>
//       </select>
//     </div>
//     <div className="flex justify-end space-x-2">
//       <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
//       <button type="submit">Update</button>
//     </div>
//   </form>
// )}

// };

//   const filteredFreshers = freshers.filter(fresher =>
//     fresher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//     fresher.email.toLowerCase().includes(searchTerm.toLowerCase())
//   );

//   const filteredTrainers = trainers.filter(trainer =>
//     trainer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//     trainer.email.toLowerCase().includes(searchTerm.toLowerCase())
//   );

//   const TabButton = ({ id, label, icon: Icon }) => (
//     <button
//       onClick={() => setActiveTab(id)}
//       className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
//         activeTab === id
//           ? 'bg-blue-600 text-white'
//           : 'text-gray-600 hover:bg-gray-100'
//       }`}
//     >
//       <Icon size={20} />
//       <span>{label}</span>
//     </button>
//   );

//   const FreshersTab = () => (
//     <div className="space-y-6">
//       <div className="flex justify-between items-center">
//         <h2 className="text-2xl font-bold text-gray-800">Manage Freshers</h2>
//         <div className="flex space-x-4">
//           <div className="relative">
//             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
//             <input
//               type="text"
//               placeholder="Search freshers..."
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//               className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             />
//           </div>
//         </div>
//       </div>

//       <div className="bg-white rounded-lg shadow overflow-hidden">
//         <table className="min-w-full divide-y divide-gray-200">
//           <thead className="bg-gray-50">
//             <tr>
//               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                 Fresher Details
//               </th>
//               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                 Status
//               </th>
//               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                 Progress
//               </th>
//               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                 Actions
//               </th>
//             </tr>
//           </thead>
//           <tbody className="bg-white divide-y divide-gray-200">
//             {filteredFreshers.map((fresher) => (
//               <tr key={fresher._id} className="hover:bg-gray-50">
//                 <td className="px-6 py-4 whitespace-nowrap">
//                   <div className="flex items-center">
//                     <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
//                       <span className="text-white font-medium">
//                         {fresher.name.charAt(0)}
//                       </span>
//                     </div>
//                     <div className="ml-4">
//                       <div className="text-sm font-medium text-gray-900">{fresher.name}</div>
//                       <div className="text-sm text-gray-500">{fresher.email}</div>
//                       <div className="text-xs text-gray-400">
//                         Joined: {new Date(fresher.createdAt).toLocaleDateString()}
//                       </div>
//                     </div>
//                   </div>
//                 </td>
//                 <td className="px-6 py-4 whitespace-nowrap">
//                   <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
//                     fresher.isActive 
//                       ? 'bg-green-100 text-green-800' 
//                       : 'bg-red-100 text-red-800'
//                   }`}>
//                     {fresher.isActive ? 'Active' : 'Inactive'}
//                   </span>
//                   <div className="text-xs text-gray-500 mt-1">
//                     Premium: {fresher.isPremium ? 'Yes' : 'No'}
//                   </div>
//                 </td>
//                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                   <div className="space-y-1">
//                     <div>Resume: {fresher.resumeStatus || 'Not uploaded'}</div>
//                     <div>Interviews: {fresher.interviewHistory?.length || 0}</div>
//                     <div>SWOT: {fresher.swotAnalysis ? 'Completed' : 'Pending'}</div>
//                     <div>Training Hours: {fresher.trainingHours || 0}</div>
//                   </div>
//                 </td>
//                 <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
//                   <button
//                     onClick={() => openModal('viewFresher', fresher)}
//                     className="text-blue-600 hover:text-blue-900"
//                   >
//                     <Eye size={16} />
//                   </button>
//                   <button
//                     onClick={() => openModal('editFresher', fresher)}
//                     className="text-green-600 hover:text-green-900"
//                   >
//                     <Edit size={16} />
//                   </button>
//                   <button
//                     onClick={() => handleDeactivateUser(fresher._id, 'freshers')}
//                     className="text-red-600 hover:text-red-900"
//                   >
//                     <Trash2 size={16} />
//                   </button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );

//   const TrainersTab = () => (
//     <div className="space-y-6">
//       <div className="flex justify-between items-center">
//         <h2 className="text-2xl font-bold text-gray-800">Manage Trainers</h2>
//         <div className="relative">
//           <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
//           <input
//             type="text"
//             placeholder="Search trainers..."
//             value={searchTerm}
//             onChange={(e) => setSearchTerm(e.target.value)}
//             className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//           />
//         </div>
//       </div>

//       <div className="bg-white rounded-lg shadow overflow-hidden">
//         <table className="min-w-full divide-y divide-gray-200">
//           <thead className="bg-gray-50">
//             <tr>
//               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                 Trainer Details
//               </th>
//               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                 Expertise
//               </th>
//               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                 Performance
//               </th>
//               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                 Actions
//               </th>
//             </tr>
//           </thead>
//           <tbody className="bg-white divide-y divide-gray-200">
//             {filteredTrainers.map((trainer) => (
//               <tr key={trainer._id} className="hover:bg-gray-50">
//                 <td className="px-6 py-4 whitespace-nowrap">
//                   <div className="flex items-center">
//                     <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
//                       <span className="text-white font-medium">
//                         {trainer.name.charAt(0)}
//                       </span>
//                     </div>
//                     <div className="ml-4">
//                       <div className="text-sm font-medium text-gray-900">{trainer.name}</div>
//                       <div className="text-sm text-gray-500">{trainer.email}</div>
//                       <div className="text-xs text-gray-400">
//                         Experience: {trainer.experience} years
//                       </div>
//                     </div>
//                   </div>
//                 </td>
//                 <td className="px-6 py-4 whitespace-nowrap">
//                   <div className="text-sm text-gray-900">
//                     {trainer.qualifications?.join(', ') || 'Not specified'}
//                   </div>
//                   <div className="text-xs text-gray-500 mt-1">
//                     Areas: {trainer.expertiseAreas?.join(', ') || 'Not specified'}
//                   </div>
//                 </td>
//                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                   <div className="space-y-1">
//                     <div>Rating: {trainer.averageRating || 'N/A'}/5</div>
//                     <div>Sessions: {trainer.sessionCount || 0}</div>
//                     <div>Students: {trainer.studentsCount || 0}</div>
//                   </div>
//                 </td>
//                 <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
//                   <button
//                     onClick={() => openModal('viewTrainer', trainer)}
//                     className="text-blue-600 hover:text-blue-900"
//                   >
//                     <Eye size={16} />
//                   </button>
//                   <button
//                     onClick={() => openModal('editTrainer', trainer)}
//                     className="text-green-600 hover:text-green-900"
//                   >
//                     <Edit size={16} />
//                   </button>
//                   <button
//                     onClick={() => handleDeactivateUser(trainer._id, 'trainers')}
//                     className="text-red-600 hover:text-red-900"
//                   >
//                     <Trash2 size={16} />
//                   </button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );

//   const NoticesTab = () => (
//   <div className="space-y-6">
//     <div className="flex justify-between items-center">
//       <h2 className="text-2xl font-bold text-gray-800">Event Notices</h2>
//       <button
//         onClick={() => openModal('addNotice')}
//         className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
//       >
//         <Bell size={20} />
//         <span>Add Event</span>
//       </button>
//     </div>

//     <div className="grid gap-4">
//       {notices.map((notice) => (
//         <div key={notice._id} className="bg-white rounded-lg shadow p-6">
//           <div className="flex justify-between items-start">
//             <div className="flex-1">
//               <h3 className="text-lg font-semibold text-gray-900">{notice.eventName}</h3>
//               <p className="text-gray-600 mt-2">{notice.eventDescription}</p>
//               <div className="flex items-center space-x-4 mt-4 text-sm text-gray-500">
//                 <span className="flex items-center">
//                   <Calendar size={16} className="mr-1" />
//                   {new Date(notice.date).toLocaleDateString()} at {notice.time}
//                 </span>
//                 <span>Venue: {notice.venue}</span>
//                 {notice.registrationLink && (
//                   <a href={notice.registrationLink} target="_blank" className="text-blue-600 underline">
//                     Register
//                   </a>
//                 )}
//               </div>
//               {notice.otherInfo && <p className="mt-2 text-sm text-gray-400">{notice.otherInfo}</p>}
//             </div>
//             <div className="flex space-x-2">
//               <button
//             onClick={() => openModal('editNotice', notice)}
//             className="text-blue-600 hover:text-blue-900"
//             >
//             <Edit size={16} />
//               </button>

//               <div>
//                 {modalType === 'editNotice' && (
//   <form onSubmit={(e) => {
//       e.preventDefault();
//       handleUpdateNotice(formData._id, formData);
//   }} className="space-y-4">
//     <div>
//       <label>Event Name</label>
//       <input
//         type="text"
//         value={formData.eventName || ''}
//         onChange={(e) => setFormData({...formData, eventName: e.target.value})}
//         required
//       />
//     </div>
//     <div>
//       <label>Description</label>
//       <textarea
//         value={formData.eventDescription || ''}
//         onChange={(e) => setFormData({...formData, eventDescription: e.target.value})}
//         required
//       />
//     </div>
//     <div>
//       <label>Date & Time</label>
//       <input
//         type="datetime-local"
//         value={formData.date || ''}
//         onChange={(e) => setFormData({...formData, date: e.target.value})}
//         required
//       />
//     </div>
//     <div>
//       <label>Venue</label>
//       <input
//         type="text"
//         value={formData.venue || ''}
//         onChange={(e) => setFormData({...formData, venue: e.target.value})}
//         required
//       />
//     </div>
//     <div>
//       <label>Registration Link</label>
//       <input
//         type="url"
//         value={formData.registrationLink || ''}
//         onChange={(e) => setFormData({...formData, registrationLink: e.target.value})}
//       />
//     </div>
//     <div>
//       <label>Other Info</label>
//       <input
//         type="text"
//         value={formData.otherInfo || ''}
//         onChange={(e) => setFormData({...formData, otherInfo: e.target.value})}
//       />
//     </div>
//     <div>
//       <label>Priority</label>
//       <select
//         value={formData.priority || 'medium'}
//         onChange={(e) => setFormData({...formData, priority: e.target.value})}
//       >
//         <option value="low">Low</option>
//         <option value="medium">Medium</option>
//         <option value="high">High</option>
//       </select>
//     </div>
//     <div className="flex justify-end space-x-2">
//       <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
//       <button type="submit">Update</button>
//     </div>
//   </form>
// )}

//               </div>
//               <button 
//               onClick={() => handleDeleteNotice(notice._id)}
//               className="text-red-600 hover:text-red-900">
//                 <Trash2 size={16} />
//               </button>
//             </div>
//           </div>
//         </div>
//       ))}
//     </div>
//   </div>
// );


//   const Modal = () => {
//     if (!showModal) return null;

//     const handleSubmit = async (e) => {
//   e.preventDefault();

//   if (modalType !== 'addNotice') return;

//   try {
//     const response = await fetch('/api/admin/notices', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(formData), // formData matches Notice schema
//     });

//     const data = await response.json();

//     if (response.ok) {
//       alert('Notice added successfully!');
//       fetchNotices(); // refresh notices list
//       setShowModal(false);
//       setFormData({});
//     } else {
//       alert(data.error || 'Failed to add notice');
//     }
//   } catch (error) {
//     console.error(error);
//     alert('Something went wrong');
//   }
// };


//     return (
//       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//         <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
//           <div className="flex justify-between items-center mb-4">
//             <h3 className="text-lg font-semibold">
//               {modalType === 'addNotice' && 'Add Event Notice'}
//               {modalType === 'editFresher' && 'Edit Fresher Details'}
//               {modalType === 'editTrainer' && 'Edit Trainer Details'}
//               {modalType === 'viewFresher' && 'Fresher Profile'}
//               {modalType === 'viewTrainer' && 'Trainer Profile'}
//             </h3>
//             <button
//               onClick={() => setShowModal(false)}
//               className="text-gray-500 hover:text-gray-700"
//             >
//               ×
//             </button>
//           </div>

//           {modalType === 'addNotice' && (
//   <form onSubmit={handleSubmit} className="space-y-4">
//     <div>
//       <label className="block text-sm font-medium text-gray-700">Event Name</label>
//       <input
//         type="text"
//         value={formData.eventName || ''}
//         onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
//         className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
//         required
//       />
//     </div>

//     <div>
//       <label className="block text-sm font-medium text-gray-700">Event Description</label>
//       <textarea
//         value={formData.eventDescription || ''}
//         onChange={(e) => setFormData({ ...formData, eventDescription: e.target.value })}
//         className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
//         rows="3"
//         required
//       />
//     </div>

//     <div className="grid grid-cols-2 gap-4">
//       <div>
//         <label className="block text-sm font-medium text-gray-700">Date</label>
//         <input
//           type="date"
//           value={formData.date || ''}
//           onChange={(e) => setFormData({ ...formData, date: e.target.value })}
//           className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
//           required
//         />
//       </div>

//       <div>
//         <label className="block text-sm font-medium text-gray-700">Time</label>
//         <input
//           type="time"
//           value={formData.time || ''}
//           onChange={(e) => setFormData({ ...formData, time: e.target.value })}
//           className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
//           required
//         />
//       </div>
//     </div>

//     <div>
//       <label className="block text-sm font-medium text-gray-700">Venue</label>
//       <input
//         type="text"
//         value={formData.venue || ''}
//         onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
//         className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
//         required
//       />
//     </div>

//     <div>
//       <label className="block text-sm font-medium text-gray-700">Registration Link</label>
//       <input
//         type="url"
//         value={formData.registrationLink || ''}
//         onChange={(e) => setFormData({ ...formData, registrationLink: e.target.value })}
//         className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
//         placeholder="https://example.com/register"
//       />
//     </div>

//     <div>
//       <label className="block text-sm font-medium text-gray-700">Other Info</label>
//       <textarea
//         value={formData.otherInfo || ''}
//         onChange={(e) => setFormData({ ...formData, otherInfo: e.target.value })}
//         className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
//         rows="2"
//       />
//     </div>

//     <div className="flex justify-end space-x-3">
//       <button
//         type="button"
//         onClick={() => setShowModal(false)}
//         className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
//       >
//         Cancel
//       </button>
//       <button
//         type="submit"
//         className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
//       >
//         Add Event
//       </button>
//     </div>
//   </form>
// )}


//           {modalType === 'editFresher' && (
//             <form onSubmit={handleSubmit} className="space-y-4">
//               <div>
//                 <label className="block text-sm font-medium text-gray-700">Name</label>
//                 <input
//                   type="text"
//                   value={formData.name || ''}
//                   onChange={(e) => setFormData({...formData, name: e.target.value})}
//                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-medium text-gray-700">Email</label>
//                 <input
//                   type="email"
//                   value={formData.email || ''}
//                   onChange={(e) => setFormData({...formData, email: e.target.value})}
//                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
//                 />
//               </div>
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="flex items-center">
//                     <input
//                       type="checkbox"
//                       checked={formData.isActive || false}
//                       onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
//                       className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
//                     />
//                     <span className="ml-2 text-sm text-gray-700">Active</span>
//                   </label>
//                 </div>
//                 <div>
//                   <label className="flex items-center">
//                     <input
//                       type="checkbox"
//                       checked={formData.isPremium || false}
//                       onChange={(e) => setFormData({...formData, isPremium: e.target.checked})}
//                       className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
//                     />
//                     <span className="ml-2 text-sm text-gray-700">Premium</span>
//                   </label>
//                 </div>
//               </div>
//               <div className="flex justify-end space-x-3">
//                 <button
//                   type="button"
//                   onClick={() => setShowModal(false)}
//                   className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   type="submit"
//                   className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
//                 >
//                   Update
//                 </button>
//               </div>
//             </form>
//           )}

//           {modalType === 'viewFresher' && selectedUser && (
//             <div className="space-y-6">
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <h4 className="font-medium text-gray-900">Personal Information</h4>
//                   <div className="mt-2 space-y-2 text-sm">
//                     <p><span className="font-medium">Name:</span> {selectedUser.name}</p>
//                     <p><span className="font-medium">Email:</span> {selectedUser.email}</p>
//                     <p><span className="font-medium">Phone:</span> {selectedUser.phone || 'N/A'}</p>
//                     <p><span className="font-medium">Location:</span> {selectedUser.location || 'N/A'}</p>
//                   </div>
//                 </div>
//                 <div>
//                   <h4 className="font-medium text-gray-900">Account Status</h4>
//                   <div className="mt-2 space-y-2 text-sm">
//                     <p><span className="font-medium">Status:</span> 
//                       <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
//                         selectedUser.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
//                       }`}>
//                         {selectedUser.isActive ? 'Active' : 'Inactive'}
//                       </span>
//                     </p>
//                     <p><span className="font-medium">Premium:</span> {selectedUser.isPremium ? 'Yes' : 'No'}</p>
//                     <p><span className="font-medium">Joined:</span> {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
//                   </div>
//                 </div>
//               </div>
              
//               <div>
//                 <h4 className="font-medium text-gray-900">Progress Overview</h4>
//                 <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
//                   <p><span className="font-medium">Resume Status:</span> {selectedUser.resumeStatus || 'Not uploaded'}</p>
//                   <p><span className="font-medium">Training Hours:</span> {selectedUser.trainingHours || 0}</p>
//                   <p><span className="font-medium">Interviews:</span> {selectedUser.interviewHistory?.length || 0}</p>
//                   <p><span className="font-medium">SWOT Analysis:</span> {selectedUser.swotAnalysis ? 'Completed' : 'Pending'}</p>
//                 </div>
//               </div>

//               {selectedUser.interviewHistory && selectedUser.interviewHistory.length > 0 && (
//                 <div>
//                   <h4 className="font-medium text-gray-900">Recent Interviews</h4>
//                   <div className="mt-2 space-y-2">
//                     {selectedUser.interviewHistory.slice(-3).map((interview, index) => (
//                       <div key={index} className="text-sm bg-gray-50 p-2 rounded">
//                         <p><span className="font-medium">Company:</span> {interview.company}</p>
//                         <p><span className="font-medium">Date:</span> {new Date(interview.date).toLocaleDateString()}</p>
//                         <p><span className="font-medium">Status:</span> {interview.status}</p>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               )}
//             </div>
//           )}
//         </div>
//       </div>
//     );
//   };

//   return (
//     <div className="min-h-screen bg-gray-100">
//       <div className="bg-white shadow">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <div className="flex justify-between items-center py-6">
//             <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
//             <div className="flex items-center space-x-4">
//               <div className="text-sm text-gray-500">
//                 Total Freshers: {freshers.length} | Active Trainers: {trainers.filter(t => t.isActive).length}
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         <div className="flex space-x-1 mb-8 bg-white p-1 rounded-lg shadow-sm">
//           <TabButton id="freshers" label="Manage Freshers" icon={UserPlus} />
//           <TabButton id="trainers" label="Manage Trainers" icon={Award} />
//           <TabButton id="notices" label="Event Notices" icon={Bell} />
//         </div>

//         {loading ? (
//           <div className="flex justify-center items-center h-64">
//             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
//           </div>
//         ) : (
//           <div>
//             {activeTab === 'freshers' && <FreshersTab />}
//             {activeTab === 'trainers' && <TrainersTab />}
//             {activeTab === 'notices' && <NoticesTab />}
//           </div>
//         )}
//       </div>

//       <Modal />
//     </div>
//   );
// };

// export default AdminDashboard;