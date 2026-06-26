// src/hooks/useAuth.ts
// src/hook/useAuth.ts
import { useState, useEffect } from 'react';
import { auth, googleProvider } from '../firebaseConfig';

// 🚀 [복구 완료] 실제 일하는 함수 3개와 User 타입을 명확하게 분리해서 모두 가져옵니다!
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 앱이 켜질 때 유저가 로그인 상태인지 파이어베이스에 물어봅니다.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe(); // 컴포넌트가 꺼질 때 리스너 해제
  }, []);

  // 구글 로그인 팝업 띄우기
  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
      alert("로그인 중 문제가 발생했습니다.");
    }
  };

  // 로그아웃
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return { user, loading, loginWithGoogle, logout };
};