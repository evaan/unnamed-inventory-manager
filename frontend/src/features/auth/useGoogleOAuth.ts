import { useGoogleLogin } from '@react-oauth/google';

export const useGoogleOAuth = (onSuccessCallback?: (token: string) => void) => {
  const loginWithToken = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      if (onSuccessCallback) {
        onSuccessCallback(tokenResponse.access_token);
      }
    },
    onError: (error) => console.error("OAuth Error:", error),
  });

  return { loginWithToken };
};