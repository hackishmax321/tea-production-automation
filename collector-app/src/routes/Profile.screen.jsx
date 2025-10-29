import React from 'react';

const ProfileDashboard = () => {
  // Sample data - in a real app, this would come from state or props
  const userData = {
    name: "Emma Chen",
    membership: "Tea Connoisseur",
    joinDate: "March 2023",
    teaCollections: 42,
    tastingNotes: 128,
    favorites: 19,
    teaTypes: [
      { name: "Green Tea", count: 12 },
      { name: "Black Tea", count: 9 },
      { name: "Oolong Tea", count: 8 },
      { name: "Herbal Tea", count: 7 },
      { name: "White Tea", count: 6 }
    ],
    monthlyStats: {
      teasSampled: 15,
      tastingNotes: 28,
      newCollections: 5
    },
    dailyStats: {
      teasSampled: 2,
      tastingNotes: 4,
      calories: 12
    },
    goals: {
      teasToTry: 100,
      currentProgress: 42,
      tastingNotesGoal: 200,
      notesProgress: 128
    }
  };

  return (
    <div className="tea-dashboard-container">
      <div className="tea-leaves">
        <div className="leaf leaf1"></div>
        <div className="leaf leaf2"></div>
        <div className="leaf leaf3"></div>
      </div>
      
      <div className="dashboard-header">
        <div className="user-info">
          <div className="user-avatar">
            <i className="fas fa-user"></i>
          </div>
          <div className="user-details">
            <h2>{userData.name}</h2>
            <p>{userData.membership} • Member since {userData.joinDate}</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="action-btn">
            <i className="fas fa-cog"></i>
          </button>
          <button className="action-btn">
            <i className="fas fa-bell"></i>
          </button>
        </div>
      </div>
      
      <div className="dashboard-content">
        {/* Overview Stats Card */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3 className="card-title">Tea Collection Overview</h3>
            <div className="card-icon">
              <i className="fas fa-chart-pie"></i>
            </div>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <p className="stat-value">{userData.teaCollections}</p>
              <p className="stat-label">Total Teas</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">{userData.tastingNotes}</p>
              <p className="stat-label">Tasting Notes</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">{userData.favorites}</p>
              <p className="stat-label">Favorites</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">{userData.teaTypes.length}</p>
              <p className="stat-label">Tea Types</p>
            </div>
          </div>
        </div>
        
        {/* Monthly Stats Card */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3 className="card-title">This Month</h3>
            <div className="card-icon">
              <i className="fas fa-calendar-alt"></i>
            </div>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <p className="stat-value">{userData.monthlyStats.teasSampled}</p>
              <p className="stat-label">Teas Sampled</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">{userData.monthlyStats.tastingNotes}</p>
              <p className="stat-label">Tasting Notes</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">{userData.monthlyStats.newCollections}</p>
              <p className="stat-label">New Additions</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">28</p>
              <p className="stat-label">Brewing Days</p>
            </div>
          </div>
        </div>
        
        {/* Tea Types Card */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3 className="card-title">Tea Collection by Type</h3>
            <div className="card-icon">
              <i className="fas fa-leaf"></i>
            </div>
          </div>
          <ul className="collection-list">
            {userData.teaTypes.map((tea, index) => (
              <li key={index} className="collection-item">
                <span className="collection-name">{tea.name}</span>
                <span className="collection-count">{tea.count}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Daily Stats Card */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3 className="card-title">Today's Activity</h3>
            <div className="card-icon">
              <i className="fas fa-coffee"></i>
            </div>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <p className="stat-value">{userData.dailyStats.teasSampled}</p>
              <p className="stat-label">Teas Sampled</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">{userData.dailyStats.tastingNotes}</p>
              <p className="stat-label">Tasting Notes</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">{userData.dailyStats.calories}</p>
              <p className="stat-label">Calories</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">1.2L</p>
              <p className="stat-label">Water Intake</p>
            </div>
          </div>
        </div>
        
        {/* Goals Card */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3 className="card-title">Collection Goals</h3>
            <div className="card-icon">
              <i className="fas fa-flag"></i>
            </div>
          </div>
          <div className="progress-container">
            <div className="progress-header">
              <span className="progress-label">Teas to Try</span>
              <span className="progress-value">{userData.goals.currentProgress}/{userData.goals.teasToTry}</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(userData.goals.currentProgress / userData.goals.teasToTry) * 100}%` }}
              ></div>
            </div>
          </div>
          <div className="progress-container">
            <div className="progress-header">
              <span className="progress-label">Tasting Notes</span>
              <span className="progress-value">{userData.goals.notesProgress}/{userData.goals.tastingNotesGoal}</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(userData.goals.notesProgress / userData.goals.tastingNotesGoal) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        {/* Recent Activity Card */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3 className="card-title">Recent Activity</h3>
            <div className="card-icon">
              <i className="fas fa-history"></i>
            </div>
          </div>
          <ul className="collection-list">
            <li className="collection-item">
              <span className="collection-name">Added Jasmine Green Tea to collection</span>
              <span className="collection-count">Today</span>
            </li>
            <li className="collection-item">
              <span className="collection-name">Posted tasting notes for Earl Grey</span>
              <span className="collection-count">Yesterday</span>
            </li>
            <li className="collection-item">
              <span className="collection-name">Earned "Tea Explorer" badge</span>
              <span className="collection-count">2 days ago</span>
            </li>
            <li className="collection-item">
              <span className="collection-name">Shared collection with friends</span>
              <span className="collection-count">4 days ago</span>
            </li>
          </ul>
        </div>
      </div>
      
      <div className="dashboard-footer">
        <p className="footer-text">
          Keep exploring the world of tea! <a href="#">Discover new teas</a> to add to your collection.
        </p>
      </div>
    </div>
  );
};

export default ProfileDashboard;