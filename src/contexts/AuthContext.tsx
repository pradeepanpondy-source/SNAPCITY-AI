import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import toast from 'react-hot-toast';

const isEmailAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const e = email.toLowerCase();
  return e === 'admin@snapcity.ai' || e.endsWith('.gov.in');
};

export interface User {
  uid: string;
  email: string | null;
  role?: 'citizen' | 'admin';
  department?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isFirebaseConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY;

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      const localUser = localStorage.getItem('demo_user');
      if (localUser) {
        setUser(JSON.parse(localUser));
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // ── Admin override: official emails always get role=admin ──
        const isAdminEmail = isEmailAdmin(currentUser.email);

        let role: 'citizen' | 'admin' = isAdminEmail ? 'admin' : 'citizen';
        let department: string | undefined = undefined;

        if (db) {
          try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              // Keep Firestore role unless this is the admin email
              role = isAdminEmail ? 'admin' : (data.role || 'citizen');
              department = data.department;
              // Ensure admin email always has role=admin in Firestore
              if (isAdminEmail && data.role !== 'admin') {
                await setDoc(doc(db, 'users', currentUser.uid), { role: 'admin', email: currentUser.email }, { merge: true });
              }
            } else {
              // Create user profile — force admin role for admin email
              await setDoc(doc(db, 'users', currentUser.uid), {
                email: currentUser.email,
                role: isAdminEmail ? 'admin' : 'citizen',
                createdAt: new Date()
              });
            }
          } catch (error) {
            console.error('Error fetching user profile:', error);
          }
        }

        setUser({
          uid: currentUser.uid,
          email: currentUser.email,
          role,
          department
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isFirebaseConfigured]);

  const login = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !auth) {
      const mockUser: User = { uid: 'demo-' + Date.now(), email, role: isEmailAdmin(email) ? 'admin' : 'citizen' };
      localStorage.setItem('demo_user', JSON.stringify(mockUser));
      setUser(mockUser);
      toast.success('Logged in successfully!');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Logged in successfully!');
    } catch (error: any) {
      if (error.code === 'auth/api-key-not-valid' || error.message?.includes('api-key-not-valid') || error.code === 'auth/network-request-failed') {
        const mockUser: User = { uid: 'demo-' + Date.now(), email, role: isEmailAdmin(email) ? 'admin' : 'citizen' };
        localStorage.setItem('demo_user', JSON.stringify(mockUser));
        setUser(mockUser);
        toast.success('Logged in successfully (Demo Mode)!');
      } else {
        console.error('Error logging in:', error);
        throw error;
      }
    }
  };

  const signup = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !auth) {
      const mockUser: User = { uid: 'demo-' + Date.now(), email, role: isEmailAdmin(email) ? 'admin' : 'citizen' };
      localStorage.setItem('demo_user', JSON.stringify(mockUser));
      setUser(mockUser);
      toast.success('Account created successfully!');
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (db) {
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email,
          role: isEmailAdmin(email) ? 'admin' : 'citizen',
          createdAt: new Date()
        });
      }
      toast.success('Account created successfully!');
    } catch (error: any) {
      if (error.code === 'auth/api-key-not-valid' || error.message?.includes('api-key-not-valid') || error.code === 'auth/network-request-failed') {
        const mockUser: User = { uid: 'demo-' + Date.now(), email, role: isEmailAdmin(email) ? 'admin' : 'citizen' };
        localStorage.setItem('demo_user', JSON.stringify(mockUser));
        setUser(mockUser);
        toast.success('Account created successfully (Demo Mode)!');
      } else {
        console.error('Error signing up:', error);
        throw error;
      }
    }
  };

  const logout = async () => {
    if (!isFirebaseConfigured || !auth) {
      localStorage.removeItem('demo_user');
      setUser(null);
      toast.success('Logged out successfully!');
      return;
    }
    try {
      await signOut(auth);
      toast.success('Logged out successfully!');
    } catch (error: any) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
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
