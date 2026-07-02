from passlib.context import CryptContext

# Use pbkdf2_sha256 so passwords above 72 bytes are supported safely.
# bcrypt is not ideal here because it truncates passwords longer than 72 bytes.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
