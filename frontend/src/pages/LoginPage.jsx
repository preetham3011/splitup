import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { SplitupLogoLarge } from '@/components/SplitupLogo';
import { Wallet, Users, PieChart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const googleButtonRef = useRef(null);

  useEffect(() => {
    // Redirect if already authenticated
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    // Initialize Google Identity Services and render button
    const initializeGoogleSignIn = () => {
      if (!window.google || !GOOGLE_CLIENT_ID) {
        console.warn('Google Sign-In not available');
        return;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });

        // Render the Google Sign-In button
        if (googleButtonRef.current) {
          window.google.accounts.id.renderButton(
            googleButtonRef.current,
            {
              theme: 'outline',
              size: 'large',
              width: googleButtonRef.current.offsetWidth || 350,
              text: 'continue_with',
              shape: 'rectangular',
            }
          );
        }
      } catch (error) {
        console.error('Failed to initialize Google Sign-In:', error);
      }
    };

    // Wait for Google script to load
    if (window.google) {
      initializeGoogleSignIn();
    } else {
      window.addEventListener('load', initializeGoogleSignIn);
      return () => window.removeEventListener('load', initializeGoogleSignIn);
    }
  }, []);

  const handleCredentialResponse = async (response) => {
    try {
      const result = await login(response.credential);
      
      if (result.success) {
        toast.success('Successfully signed in!');
        navigate('/dashboard');
      } else {
        toast.error(result.error || 'Sign in failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    }
  };

  const handleDemoLogin = () => {
    // Fallback for demo mode when Google Client ID is not configured
    toast.info('Demo Mode: Google OAuth is not configured. Navigating to dashboard...');
    navigate('/dashboard');
  };

  const features = [
    {
      icon: Users,
      title: 'Split with friends',
      description: 'Easily divide expenses among roommates, trips, or any group',
    },
    {
      icon: PieChart,
      title: 'Track budgets',
      description: 'Set category-wise budgets and monitor spending in real-time',
    },
    {
      icon: Wallet,
      title: 'Settle up',
      description: 'See who owes whom and simplify debts with one tap',
    },
  ];

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'hsl(168, 40%, 96%)' }}>
      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 xl:px-24">
        <div className="max-w-lg">
          <SplitupLogoLarge className="mb-8" />
          
          <h1 className="text-4xl font-bold text-foreground mb-4 leading-tight">
            Split expenses.
            <br />
            <span style={{ color: 'hsl(168, 58%, 44%)' }}>Stay stress-free.</span>
          </h1>
          
          <p className="text-lg text-muted-foreground mb-10">
            The smartest way to manage shared expenses with roommates, friends, and travel buddies.
          </p>
          
          <div className="space-y-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-4 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'hsl(168, 45%, 92%)' }}
                >
                  <feature.icon
                    className="w-5 h-5"
                    style={{ color: 'hsl(168, 58%, 44%)' }}
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Card */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-elevated p-8 lg:p-10 animate-scale-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <SplitupLogoLarge />
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Welcome to splitUP
            </h2>
            <p className="text-muted-foreground">
              Sign in to manage your shared expenses
            </p>
          </div>

          {/* Google Sign In Button */}
          {GOOGLE_CLIENT_ID ? (
            <div ref={googleButtonRef} className="w-full mb-6" />
          ) : (
            <Button
              onClick={handleDemoLogin}
              variant="outline"
              className="w-full h-12 text-base font-medium gap-3 border-2 hover:bg-muted/50 mb-6"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Secure sign-in
              </span>
            </div>
          </div>

          {/* Footer links */}
          <div className="mt-8 space-y-4">
            <p className="text-xs text-muted-foreground text-center">
              By signing in, you agree to our{' '}
              <button className="underline hover:text-foreground transition-colors" style={{ color: 'hsl(168, 58%, 44%)' }}>
                Terms of Service
              </button>
              {' '}and{' '}
              <button className="underline hover:text-foreground transition-colors" style={{ color: 'hsl(168, 58%, 44%)' }}>
                Privacy Policy
              </button>
            </p>
            <p className="text-xs text-muted-foreground text-center">
              © 2026 SplitUP. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
