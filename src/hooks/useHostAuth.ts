import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, HOST_EMAIL_DOMAIN } from "../firebase";

export function isHostUser(user: User | null): boolean {
  return !!user && user.emailVerified && !!user.email?.endsWith(`@${HOST_EMAIL_DOMAIN}`);
}

// 主催者判定はUI表示用。実際の権限はDBルールが auth.token.email で強制する
export function useHostAuth() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return { user, loading, isHost: isHostUser(user) };
}
