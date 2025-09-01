import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  ip?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string, location?: LocationData | null) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  messageCount: number;
  incrementMessageCount: () => void;
  resetMessageCount: () => void;
  canSendMessage: boolean;
  maxFreeMessages: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [messageCount, setMessageCount] = useState(0);
  const maxFreeMessages = 10;

  // For development/testing purposes - expose reset function globally
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).resetMessageCount = resetMessageCount;
      console.log('Development mode: Use window.resetMessageCount() to reset guest message count');
    }
  }, []);

  // Load message count from localStorage for non-authenticated users
  useEffect(() => {
    if (!user) {
      const storedCount = localStorage.getItem('guest_message_count');
      if (storedCount) {
        setMessageCount(parseInt(storedCount, 10));
      }
    }
  }, [user]);

  // Check for existing token on app start
  useEffect(() => {
    const checkExistingAuth = async () => {
      console.log('🔍 [DEBUG] AuthContext: Checking existing auth...');
      
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');
      
      console.log('🔍 [DEBUG] AuthContext: Token exists:', !!token);
      console.log('🔍 [DEBUG] AuthContext: User data exists:', !!userData);
      
      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);
          console.log('🔍 [DEBUG] AuthContext: Parsed user data:', JSON.stringify(parsedUser, null, 2));
          
          // Always fetch the latest user profile to ensure correct role
          try {
            console.log('🔍 [DEBUG] Fetching user profile for:', parsedUser.email);
            console.log('🔍 [DEBUG] API URL:', import.meta.env.VITE_API_URL || 'http://localhost:8000');
            
            const profileResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/walker/get_user_profile`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email: parsedUser.email }),
            });
            
            console.log('🔍 [DEBUG] Profile response status:', profileResponse.status);
            console.log('🔍 [DEBUG] Profile response headers:', Object.fromEntries(profileResponse.headers.entries()));
            
            if (profileResponse.ok) {
              const profileData = await profileResponse.json();
              console.log('🔍 [DEBUG] Profile response data:', JSON.stringify(profileData, null, 2));
              
              if (profileData.reports && profileData.reports[0] && profileData.reports[0].user) {
                const userProfile = profileData.reports[0].user;
                console.log('✅ [DEBUG] User profile found:', JSON.stringify(userProfile, null, 2));
                
                parsedUser.role = userProfile.role || 'user';
                parsedUser.name = userProfile.name || parsedUser.name || '';
                localStorage.setItem('user_data', JSON.stringify(parsedUser));
                
                console.log('✅ [DEBUG] Updated user data:', JSON.stringify(parsedUser, null, 2));
              } else {
                console.error('🚨 [DEBUG] No user profile in response:', profileData);
              }
            } else {
              console.error('🚨 [DEBUG] Profile fetch failed with status:', profileResponse.status);
              const errorText = await profileResponse.text();
              console.error('🚨 [DEBUG] Profile error response:', errorText);
            }
          } catch (error) {
            console.error('🚨 [DEBUG] Error fetching user profile:', error);
            // Use existing role if profile fetch fails
            if (!parsedUser.role) {
              parsedUser.role = 'user';
            }
          }
          
          console.log('✅ [DEBUG] AuthContext: Setting user:', JSON.stringify(parsedUser, null, 2));
          setUser(parsedUser);
        } catch (error) {
          console.error('🚨 [DEBUG] AuthContext: Error parsing user data:', error);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_data');
        }
      } else {
        console.log('ℹ️ [DEBUG] AuthContext: No existing auth found');
      }
      
      console.log('✅ [DEBUG] AuthContext: Auth check complete, setting loading to false');
      setIsLoading(false);
    };

    checkExistingAuth();
  }, []);

    const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      let response;
      let data;
      let token;
      let userData: User;

      // First, try the built-in JAC Cloud login endpoint
      try {
        response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/user/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
          data = await response.json();
          
          // Handle different response formats
          token = data.token || data.access_token;
          
          // If no token in response but login was successful, generate a temporary token
          if (!token && data.message && data.message.includes('success')) {
            token = `temp_${Date.now()}`; // Temporary token for demo purposes
          }

          if (token) {
            // Fetch the complete user profile from our custom endpoint to get correct role
            try {
              console.log('🔍 [DEBUG] Login: Fetching user profile for:', data.user?.email || email);
              console.log('🔍 [DEBUG] Login: API URL:', import.meta.env.VITE_API_URL || 'http://localhost:8000');
              
              const profileResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/walker/get_user_profile`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: data.user?.email || email }),
              });
              
              console.log('🔍 [DEBUG] Login: Profile response status:', profileResponse.status);
              console.log('🔍 [DEBUG] Login: Profile response headers:', Object.fromEntries(profileResponse.headers.entries()));
              
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                console.log('🔍 [DEBUG] Login: Profile response data:', JSON.stringify(profileData, null, 2));
                
                if (profileData.reports && profileData.reports[0] && profileData.reports[0].user) {
                  const userProfile = profileData.reports[0].user;
                  console.log('✅ [DEBUG] Login: User profile found:', JSON.stringify(userProfile, null, 2));
                  
                  userData = {
                    id: data.user?.id || email,
                    email: userProfile.email,
                    name: userProfile.name || data.user?.name || '',
                    role: userProfile.role || 'user',
                  };
                  console.log('✅ [DEBUG] Login: Created userData from profile:', JSON.stringify(userData, null, 2));
                } else {
                  console.log('⚠️ [DEBUG] Login: No user profile in response, using fallback');
                  // Fallback to JAC Cloud data if profile fetch fails
                  userData = {
                    id: data.user?.id || email,
                    email: data.user?.email || email,
                    name: data.user?.name || '',
                    role: data.user?.is_admin ? 'admin' : 'user',
                  };
                  console.log('⚠️ [DEBUG] Login: Fallback userData:', JSON.stringify(userData, null, 2));
                }
              } else {
                console.error('🚨 [DEBUG] Login: Profile fetch failed with status:', profileResponse.status);
                const errorText = await profileResponse.text();
                console.error('🚨 [DEBUG] Login: Profile error response:', errorText);
                
                // Fallback to JAC Cloud data if profile fetch fails
                userData = {
                  id: data.user?.id || email,
                  email: data.user?.email || email,
                  name: data.user?.name || '',
                  role: data.user?.is_admin ? 'admin' : 'user',
                };
                console.log('⚠️ [DEBUG] Login: Fallback userData after error:', JSON.stringify(userData, null, 2));
              }
            } catch (profileError) {
              console.error('🚨 [DEBUG] Login: Error fetching user profile:', profileError);
              // Fallback to JAC Cloud data if profile fetch fails
              userData = {
                id: data.user?.id || email,
                email: data.user?.email || email,
                name: data.user?.name || '',
                role: data.user?.is_admin ? 'admin' : 'user',
              };
              console.log('⚠️ [DEBUG] Login: Fallback userData after exception:', JSON.stringify(userData, null, 2));
            }

            setUser(userData);
            localStorage.setItem('auth_token', token);
            localStorage.setItem('user_data', JSON.stringify(userData));
            
            // Reset message count when user logs in
            resetMessageCount();
            return; // Success with JAC Cloud login
          }
        } else {
          // JAC Cloud login failed
          throw new Error('Login failed. Please check your credentials.');
        }
      } catch (jacCloudError) {
        console.error('JAC Cloud login failed:', jacCloudError);
        throw new Error('Login failed. Please check your credentials.');
      }

    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };  const register = async (email: string, password: string, name?: string, location?: LocationData | null) => {
    setIsLoading(true);
    try {
      // Prepare registration data with location if available
      const registrationData = {
        email,
        password,
        name: name || '',
        ...(location && {
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
            city: location.city || '',
            country: location.country || '',
            ip: location.ip || ''
          }
        })
      };

      // Use JAC Cloud's built-in register endpoint
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/user/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      const data = await response.json();
      
      // JAC Cloud handles user creation automatically
      // After successful registration, login to get the token and user data
      if (data.message && data.message.includes('Successfully Registered')) {
        // Save location data if available
        if (location) {
          try {
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/walker/save_user_location`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                email, 
                location: {
                  latitude: location.latitude,
                  longitude: location.longitude,
                  city: location.city || '',
                  country: location.country || '',
                  ip: location.ip || ''
                }
              }),
            });
          } catch (locationError) {
            console.warn('Failed to save location data:', locationError);
          }
        }
        
        await login(email, password);
        return;
      }

      // Handle case where registration returns user data and token directly
      if (data.user && data.token) {
        const userData: User = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name || name || '',
          role: data.user.is_admin ? 'admin' : 'user',
        };

        setUser(userData);
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_data', JSON.stringify(userData));
        
        // Reset message count when user registers
        resetMessageCount();
      } else {
        // Fallback: try to login after registration
        await login(email, password);
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const incrementMessageCount = () => {
    if (!user) {
      const newCount = messageCount + 1;
      setMessageCount(newCount);
      localStorage.setItem('guest_message_count', newCount.toString());
    }
  };

  const resetMessageCount = () => {
    setMessageCount(0);
    localStorage.removeItem('guest_message_count');
    console.log('Guest message count has been reset to 0');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    // Reset message count when logging out
    resetMessageCount();
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    messageCount,
    incrementMessageCount,
    resetMessageCount,
    canSendMessage: !!user || messageCount < maxFreeMessages,
    maxFreeMessages,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
