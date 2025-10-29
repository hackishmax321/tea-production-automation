import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaSpinner, 
  FaUser, 
  FaLeaf, 
  FaBook, 
  FaChartPie, 
  FaPlus, 
  FaSignOutAlt, 
  FaChevronLeft, 
  FaChevronRight, 
  FaWeightHanging, 
  FaList, 
  FaMapMarkerAlt, 
  FaCalendar, 
  FaEdit, 
  FaTrash, 
  FaChartBar, 
  FaTrophy,
  FaFilter
} from 'react-icons/fa';
import { getAuthToken, getUserData, logout, authFetch } from '../utils/authUtils';
import { teaCollectionService, teaCollectionUtils } from '../utils/teaCollectionService';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('summary');
  const [stats, setStats] = useState({
    totalCollections: 0,
    favoriteTeas: 0,
    tastingNotes: 0,
    teaTypes: 0
  });
  const [recentCollections, setRecentCollections] = useState([]);
  const [dailySummary, setDailySummary] = useState({
    date: new Date().toISOString().split('T')[0],
    totalWeight: 0,
    totalRecords: 0,
    stations: [],
    collections: []
  });
  const [teaRecords, setTeaRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = () => {
      const token = getAuthToken();
      const userData = getUserData();
      
      if (!token || !userData) {
        navigate('/login');
        return;
      }
      
      setUser(userData);
      loadDashboardData();
      loadTodaySummary();
    };

    checkAuth();
  }, [navigate]);

  const loadDashboardData = async () => {
    try {
      // Load user's tea collections for stats
      if (user) {
        const userCollections = await teaCollectionService.getCollectionsByUser(user.email);
        
        setStats({
          totalCollections: userCollections.length,
          favoriteTeas: userCollections.filter(c => c.weight > 5).length, // Example logic
          tastingNotes: userCollections.filter(c => c.comment).length,
          teaTypes: [...new Set(userCollections.map(c => c.station))].length
        });

        // Recent collections (last 4)
        const recent = userCollections.slice(-4).map((collection, index) => ({
          id: collection.id || index,
          name: collection.station,
          count: collection.weight
        }));
        setRecentCollections(recent);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTodaySummary = async () => {
    if (!user) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayCollections = await teaCollectionService.getCollectionsByUserAndDate(user.email, today);
      
      const totalWeight = teaCollectionUtils.calculateTotalWeight(todayCollections);
      const stations = [...new Set(todayCollections.map(c => c.station))];
      
      setDailySummary({
        date: today,
        totalWeight,
        totalRecords: todayCollections.length,
        stations,
        collections: todayCollections
      });
    } catch (error) {
      console.error('Error loading today summary:', error);
    }
  };

  const loadDateSummary = async (date) => {
    if (!user) return;
    
    try {
      const dateCollections = await teaCollectionService.getCollectionsByUserAndDate(user.email, date);
      
      const totalWeight = teaCollectionUtils.calculateTotalWeight(dateCollections);
      const stations = [...new Set(dateCollections.map(c => c.station))];
      
      setDailySummary({
        date,
        totalWeight,
        totalRecords: dateCollections.length,
        stations,
        collections: dateCollections
      });
    } catch (error) {
      console.error('Error loading date summary:', error);
    }
  };

  const loadTeaRecords = async () => {
    if (!user) return;
    
    setRecordsLoading(true);
    try {
      const collections = await teaCollectionService.getCollectionsByUser(user.email);
      setTeaRecords(collections);
    } catch (error) {
      console.error('Error loading tea records:', error);
    } finally {
      setRecordsLoading(false);
    }
  };

  const navigateDate = (direction) => {
    const currentDate = new Date(dailySummary.date);
    const newDate = new Date(currentDate);
    
    if (direction === 'prev') {
      newDate.setDate(currentDate.getDate() - 1);
    } else {
      newDate.setDate(currentDate.getDate() + 1);
    }
    
    const newDateString = newDate.toISOString().split('T')[0];
    loadDateSummary(newDateString);
  };

  const handleLogout = () => {
    logout();
  };

  const handleProfile = () => {
    setActiveSection('profile');
  };

  const handleCollections = () => {
    setActiveSection('collections');
  };

  const handleSummary = () => {
    setActiveSection('summary');
    loadTodaySummary();
  };

  const handleTeaRecords = () => {
    setActiveSection('teaRecords');
    loadTeaRecords();
  };

  const handleAddTea = () => {
    navigate('/add-tea');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isToday = (dateString) => {
    const today = new Date().toISOString().split('T')[0];
    return dateString === today;
  };

  if (loading) {
    return (
      <div className="tea-dashboard-container">
        <div className="loading-spinner">
          <FaSpinner className="fa-spin" />
          <p>Loading your tea journey...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tea-dashboard-container">
      <div className="tea-leaves">
        <div className="leaf leaf1"></div>
        <div className="leaf leaf2"></div>
        <div className="leaf leaf3"></div>
      </div>
      
      {/* Top Navigation Icons */}
      <div className="dashboard-nav">
        <button 
          className={`nav-icon ${activeSection === 'summary' ? 'active' : ''}`}
          onClick={handleSummary}
          title="Daily Summary"
        >
          <FaChartPie />
          <span>Summary</span>
        </button>
        
        <button 
          className={`nav-icon ${activeSection === 'profile' ? 'active' : ''}`}
          onClick={handleProfile}
          title="User Profile"
        >
          <FaUser />
          <span>Profile</span>
        </button>
        
        <button 
          className={`nav-icon ${activeSection === 'teaRecords' ? 'active' : ''}`}
          onClick={handleTeaRecords}
          title="Tea Records"
        >
          <FaLeaf />
          <span>Tea Records</span>
        </button>
        
        <button 
          className={`nav-icon ${activeSection === 'collections' ? 'active' : ''}`}
          onClick={handleCollections}
          title="Collections"
        >
          <FaBook />
          <span>Collections</span>
        </button>
      </div>

      <div className="dashboard-header">
        <div className="user-info">
          <div className="user-avatar">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.full_name} />
            ) : (
              <FaUser />
            )}
          </div>
          <div className="user-details">
            <h2>Welcome back, {user?.full_name || user?.username}!</h2>
            <p>{user?.email} • Tea Enthusiast</p>
          </div>
        </div>
        
        <div className="header-actions">
          <button className="action-btn" onClick={handleAddTea} title="Add New Tea">
            <FaPlus />
          </button>
          <button className="action-btn" onClick={handleLogout} title="Logout">
            <FaSignOutAlt />
          </button>
        </div>
      </div>

      {/* Summary Section */}
      {activeSection === 'summary' && (
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Daily Summary</h2>
            <div className="date-navigation">
              <button 
                className="nav-arrow" 
                onClick={() => navigateDate('prev')}
                title="Previous Day"
              >
                <FaChevronLeft />
              </button>
              
              <span className="current-date">
                {formatDate(dailySummary.date)}
                {isToday(dailySummary.date) && <span className="today-badge">Today</span>}
              </span>
              
              <button 
                className={`nav-arrow ${isToday(dailySummary.date) ? 'disabled' : ''}`}
                onClick={() => !isToday(dailySummary.date) && navigateDate('next')}
                disabled={isToday(dailySummary.date)}
                title="Next Day"
              >
                <FaChevronRight />
              </button>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-icon">
                <FaWeightHanging />
              </div>
              <div className="summary-content">
                <div className="summary-value">{dailySummary.totalWeight} kg</div>
                <div className="summary-label">Total Weight</div>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-icon">
                <FaList />
              </div>
              <div className="summary-content">
                <div className="summary-value">{dailySummary.totalRecords}</div>
                <div className="summary-label">Total Records</div>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-icon">
                <FaMapMarkerAlt />
              </div>
              <div className="summary-content">
                <div className="summary-value">{dailySummary.stations.length}</div>
                <div className="summary-label">Stations</div>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-icon">
                <FaCalendar />
              </div>
              <div className="summary-content">
                <div className="summary-value">
                  {new Date(dailySummary.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
                <div className="summary-label">Date</div>
              </div>
            </div>
          </div>

          {dailySummary.collections.length > 0 && (
            <div className="collections-table">
              <h3>Today's Collections</h3>
              <table>
                <thead>
                  <tr>
                    <th>Station</th>
                    <th>Weight (kg)</th>
                    <th>Comment</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummary.collections.map((collection, index) => (
                    <tr key={collection.id || index}>
                      <td>{collection.station}</td>
                      <td>{collection.weight} kg</td>
                      <td>{collection.comment || '-'}</td>
                      <td>
                        {collection.created_at ? 
                          new Date(collection.created_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '-'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dailySummary.collections.length === 0 && (
            <div className="empty-state">
              <FaLeaf />
              <p>No collections found for this date</p>
              <button className="btn btn-primary" onClick={handleAddTea}>
                <FaPlus /> Add First Collection
              </button>
            </div>
          )}
        </div>
      )}

      {/* Profile Section */}
      {activeSection === 'profile' && (
        <div className="dashboard-section">
          <h2>Your Profile</h2>
          <div className="profile-content-full">
            <div className="profile-info-full">
              <div className="info-item-full">
                <span className="info-label">Username:</span>
                <span className="info-value">{user?.username}</span>
              </div>
              <div className="info-item-full">
                <span className="info-label">Full Name:</span>
                <span className="info-value">{user?.full_name}</span>
              </div>
              <div className="info-item-full">
                <span className="info-label">Email:</span>
                <span className="info-value">{user?.email}</span>
              </div>
              <div className="info-item-full">
                <span className="info-label">Role:</span>
                <span className="info-value role-badge">{user?.role}</span>
              </div>
              <div className="info-item-full">
                <span className="info-label">Member Since:</span>
                <span className="info-value">January 2024</span>
              </div>
            </div>
            <button className="btn btn-primary">
              <FaEdit /> Edit Profile
            </button>
          </div>
        </div>
      )}

      {/* Tea Records Section */}
      {activeSection === 'teaRecords' && (
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Tea Collection Records</h2>
            <div className="section-actions">
              <button className="btn btn-primary" onClick={handleAddTea}>
                <FaPlus /> Add New Record
              </button>
            </div>
          </div>

          {recordsLoading ? (
            <div className="loading-spinner">
              <FaSpinner className="fa-spin" />
              <p>Loading your tea records...</p>
            </div>
          ) : (
            <>
              {teaRecords.length > 0 ? (
                <div className="records-table-container">
                  <div className="table-filters">
                    <input 
                      type="text" 
                      placeholder="Search by station..." 
                      className="filter-input"
                    />
                    <input 
                      type="date" 
                      className="filter-input"
                    />
                    <button className="btn btn-secondary">
                      <FaFilter /> Filter
                    </button>
                  </div>
                  
                  <table className="records-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Station</th>
                        <th>Weight (kg)</th>
                        <th>Comment</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teaRecords.map((record, index) => (
                        <tr key={record.id || index}>
                          <td>{teaCollectionUtils.formatDisplayDate(record.collected_date)}</td>
                          <td>{record.station}</td>
                          <td>{record.weight} kg</td>
                          <td>{record.comment || '-'}</td>
                          <td>
                            <button className="btn-icon" title="Edit">
                              <FaEdit />
                            </button>
                            <button className="btn-icon btn-danger" title="Delete">
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <FaLeaf />
                  <p>No tea collection records found</p>
                  <button className="btn btn-primary" onClick={handleAddTea}>
                    <FaPlus /> Add First Record
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Collections Section (Original Dashboard) */}
      {activeSection === 'collections' && (
        <div className="dashboard-section">
          <h2>Your Collections Overview</h2>
          <div className="dashboard-content">
            {/* Statistics Card */}
            <div className="dashboard-card stats-card">
              <div className="card-header">
                <h3 className="card-title">Tea Collection Stats</h3>
                <div className="card-icon">
                  <FaChartBar />
                </div>
              </div>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-value">{stats.totalCollections}</div>
                  <div className="stat-label">Total Teas</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{stats.favoriteTeas}</div>
                  <div className="stat-label">Favorites</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{stats.tastingNotes}</div>
                  <div className="stat-label">Tasting Notes</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{stats.teaTypes}</div>
                  <div className="stat-label">Tea Types</div>
                </div>
              </div>
            </div>

            {/* Recent Collections Card */}
            <div className="dashboard-card collections-card">
              <div className="card-header">
                <h3 className="card-title">Recent Collections</h3>
                <div className="card-icon">
                  <FaLeaf />
                </div>
              </div>
              <ul className="collection-list">
                {recentCollections.map(collection => (
                  <li key={collection.id} className="collection-item">
                    <span className="collection-name">{collection.name}</span>
                    <span className="collection-count">{collection.count} kg</span>
                  </li>
                ))}
              </ul>
              <button className="btn btn-primary full-width" onClick={handleTeaRecords}>
                <FaBook /> View All Records
              </button>
            </div>

            {/* Progress Card */}
            <div className="dashboard-card progress-card">
              <div className="card-header">
                <h3 className="card-title">Collection Progress</h3>
                <div className="card-icon">
                  <FaTrophy />
                </div>
              </div>
              <div className="progress-container">
                <div className="progress-header">
                  <span className="progress-label">Collection Completion</span>
                  <span className="progress-value">
                    {Math.min(100, Math.round((stats.totalCollections / 50) * 100))}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ 
                    width: `${Math.min(100, Math.round((stats.totalCollections / 50) * 100))}%` 
                  }}></div>
                </div>
              </div>
              <div className="progress-container">
                <div className="progress-header">
                  <span className="progress-label">Stations Visited</span>
                  <span className="progress-value">
                    {Math.min(100, Math.round((stats.teaTypes / 10) * 100))}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ 
                    width: `${Math.min(100, Math.round((stats.teaTypes / 10) * 100))}%` 
                  }}></div>
                </div>
              </div>
              <div className="progress-container">
                <div className="progress-header">
                  <span className="progress-label">Tasting Notes</span>
                  <span className="progress-value">
                    {stats.totalCollections > 0 ? Math.round((stats.tastingNotes / stats.totalCollections) * 100) : 0}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ 
                    width: `${stats.totalCollections > 0 ? Math.round((stats.tastingNotes / stats.totalCollections) * 100) : 0}%` 
                  }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;