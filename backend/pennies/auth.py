import jwt
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jwt import PyJWKClient


def user_sub_from_token(token: str, domain: str, audience: str) -> str:
    issuer = domain if domain.startswith("https://") else f"https://{domain}"
    issuer = issuer.rstrip("/")
    try:
        signing_key = PyJWKClient(f"{issuer}/.well-known/jwks.json").get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=audience,
            issuer=f"{issuer}/",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid bearer token") from exc
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        raise HTTPException(status_code=401, detail="Invalid bearer token")
    return subject


def require_user(credentials: HTTPAuthorizationCredentials | None, domain: str | None, audience: str | None) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing bearer token")
    if not domain or not audience:
        raise HTTPException(status_code=500, detail="Auth0 is not configured")
    return user_sub_from_token(credentials.credentials, domain, audience)
