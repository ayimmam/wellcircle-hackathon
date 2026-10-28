"""Short-lived, server-side OTP state shared by all application instances."""
from sqlalchemy import BigInteger, Column, Index, Integer, String
from app.database import Base


class OTPChallenge(Base):
    __tablename__ = "whatsapp_otp_challenges"
    id = Column(String(64), primary_key=True)
    phone_e164 = Column(String(20), nullable=True)
    phone_hash = Column(String(64), nullable=False)
    ip_hash = Column(String(64), nullable=False)
    code_hash = Column(String(64), nullable=True)
    provider = Column(String(16), nullable=False)
    provider_request_id = Column(String(128), nullable=True)
    status = Column(String(16), nullable=False, default="pending")
    attempts = Column(Integer, nullable=False, default=0)
    created_at = Column(BigInteger, nullable=False)
    expires_at = Column(BigInteger, nullable=False, index=True)
    __table_args__ = (
        Index("ix_otp_phone_created", "phone_hash", "created_at"),
        Index("ix_otp_ip_created", "ip_hash", "created_at"),
    )
