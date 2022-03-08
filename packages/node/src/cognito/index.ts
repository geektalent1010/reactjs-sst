import { CognitoJwtVerifier } from "aws-jwt-verify";

export function createCognito(userPoolId: string) {
  const verifier = CognitoJwtVerifier.create({
    userPoolId,
  });

  function verify(token: string) {
    return verifier.verify(token, { clientId: null, tokenUse: "access" });
  }

  return {
    verify,
  };
}
