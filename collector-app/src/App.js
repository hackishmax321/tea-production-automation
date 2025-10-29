import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom'
import './App.css';
import WelcomeScreen from './routes/Welcome.screen';
import { useEffect, useState } from 'react';
import LoginScreen from './routes/Login.screen';
import RegisterScreen from './routes/Register.screen';
import ProfileDashboard from './routes/Profile.screen';
import Dashboard from './routes/Dashboard.screen';
import AddTeaRecord from './routes/AddTeaRecords.screen';
import { isAuthenticated, isTokenExpired, getAuthToken } from './utils/authUtils';

function App() {
  const [redirectRoute, setRedirectRoute] = useState('/welcome');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuthentication = () => {
      console.log("Checking authentication status...");
      
      const token = getAuthToken();
      const isAuthenticatedUser = isAuthenticated();
      
      console.log("Token exists:", !!token);
      console.log("isAuthenticated:", isAuthenticatedUser);
      
      if (isAuthenticatedUser && token) {
        // Check if token is expired
        if (isTokenExpired(token)) {
          console.log("Token expired, redirecting to login");
          localStorage.removeItem('authToken');
          localStorage.removeItem('userData');
          setRedirectRoute('/login');
        } else {
          console.log("User is authenticated, redirecting to dashboard");
          setRedirectRoute('/dashboard');
        }
      } else {
        console.log("User not authenticated, redirecting to welcome");
        setRedirectRoute('/welcome');
      }
      
      setIsCheckingAuth(false);
    };

    checkAuthentication();
  }, []);

  // Show loading spinner while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="App">
        <div className="loading-container">
          <div className="loading-spinner">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path='/' element={<Navigate to={redirectRoute} replace />} />
          <Route path='/welcome' element={<WelcomeScreen />} />
          <Route path='/login' element={<LoginScreen />} />
          <Route path='/register' element={<RegisterScreen />} />
          <Route path='/profile' element={<ProfileDashboard />} />
          <Route path='/dashboard' element={<Dashboard />} />
          <Route path='/add-tea' element={<AddTeaRecord />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;