
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem('recruitai_auth') === 'true';
    if (isAuthenticated) {
      navigate('/services');
    } else {
      // Redirect to login since this is the main entry point
      navigate('/');
    }
  }, [navigate]);

  return null; // This component will redirect immediately
};

export default Index;
