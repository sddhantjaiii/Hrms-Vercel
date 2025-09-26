import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login } from '../services/authService';
import { CheckCircle, Eye, EyeOff } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(false);

  useEffect(() => {
    // Check for success message from navigation state
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      if (location.state?.email) {
        setEmail(location.state.email);
      }
      // Clear the state
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const response = await login(email, password, keepSignedIn);
      
      // Check if user must change password
      if (response.must_change_password) {
        // Store user and tenant data for the password change process
        localStorage.setItem('tempUser', JSON.stringify(response.user));
        localStorage.setItem('tenant', JSON.stringify(response.tenant));
        
        // Navigate to change password page
        navigate('/change-password', { 
          state: { 
            email: email,
            message: 'Please set a new password to continue.',
            user: response.user,
            tenant: response.tenant
          }
        });
        return;
      }
      
      // Normal login flow - store authentication data
      if (response.access && response.refresh) {
        localStorage.setItem('access', response.access);
        localStorage.setItem('refresh', response.refresh);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        // Store tenant information
        if (response.tenant) {
          localStorage.setItem('tenant', JSON.stringify(response.tenant));
          console.log(`Welcome to ${response.tenant.name}! Access URL: ${response.tenant.access_url}`);
        }
        
        // Navigate to HR management dashboard
        navigate('/hr-management');
      } else {
        setError('Invalid login response - missing tokens');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen font-poppins">
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="w-[640px] min-h-[700px] rounded-3xl flex flex-col items-start justify-start p-20 bg-[#176d67] bg-opacity-100 relative overflow-hidden">
          {/* Curved diagonal shape at top left */}
          <div className="absolute top-[-250px] left-[-50px] w-[300px] h-full">
            <img src="/img/r1.png" alt="Login Visual" className="w-full h-full object-contain mb-4" />
          </div>
          <div className="absolute top-[-90px] left-[-150px] w-[600px] h-[600px]">
            <img src="/img/r2.png" alt="Login Visual" className="w-full h-full object-contain mb-4" />
          </div>
          <div className="absolute bottom-[-0px] right-[-100px] w-[350px] h-[350px]">
            <img src="/img/rr1.png" alt="Login Visual" className="w-full h-full object-contain mb-4" />
          </div>
          <div className="absolute bottom-[-20px] right-[-20px] w-[350px] h-[350px]">
            <img src="/img/rr2.png" alt="Login Visual" className="w-full h-full object-contain mb-4" />
          </div>
          
          
          <img src="/image.png" alt="Login Visual" className="w-full h-[400px] object-contain mb-4 relative z-10" />
          <img src="/logo.png" alt="SniperThink Logo" className="h-8 w-[230px] mb-4 relative z-10" />
          <h2 className="text-[40px] font-bold text-white mb-2 text-left relative z-10">Analyze. Automate.<br />Accelerate.</h2>
          <p className="text-white text-[15px] text-center mb-4 text-base relative z-10">Welcome to SniperThink, your all-in-one solution.</p>
          <a href="#" className="text-white font-medium flex items-center gap-1 hover:underline text-base relative z-10">Learn More <span aria-hidden>→</span></a>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center bg-white">
        <div className="w-full max-w-md px-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <h2 className="text-4xl font-semibold text-center text-gray-800 mb-8">Sign in</h2>
            
            {/* Success Message */}
            {successMessage && (
              <div className="bg-teal-50 text-teal-700 p-3 rounded-lg border border-teal-200 flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5" />
                {successMessage}
              </div>
            )}
            
            <div className="space-y-1">
              <input 
                type="email" 
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                placeholder="Email"
              />
            </div>
            
            <div className="space-y-1">
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  placeholder="Password"
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500" 
                  id="keep-signed-in"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                />
                <label htmlFor="keep-signed-in" className="ml-2 text-sm text-gray-500">Keep me signed in</label>
              </div>
              <button 
                type="button" 
                className="text-sm text-teal-600 hover:text-teal-900" 
                onClick={() => navigate('/forgot-password')}
              >
                Forgot password?
              </button>
            </div>
            
            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              className="w-full bg-teal-700 text-white py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors disabled:opacity-50" 
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            
            {/* <div className="flex items-center my-6">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="px-4 text-sm text-gray-500">or</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>
            
            <button 
              type="button"
              className="w-full border border-gray-300 rounded-lg py-3 px-4 flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#1A6262" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#1A6262" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#1A6262" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#1A6262" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-[#1A6262] font-medium">Sign in with Google</span>
            </button> */}
            
            <div className="text-center text-sm mt-6">
              <span className="text-gray-500">New to SniperThink? </span>
              <a href="/signup" className="text-teal-700 hover:underline font-medium">
                Sign up
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login; 