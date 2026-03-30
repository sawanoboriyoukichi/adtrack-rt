import { useEffect } from 'react';
import { useRouter } from 'next/router';
export default function Pages() {
  const router = useRouter();
  useEffect(() => { router.replace('/report/params'); }, []);
  return null;
}
