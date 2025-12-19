"""SQLAlchemy ORM Models for User
"""

import enum

from sqlalchemy import Boolean, Column, Date, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


# Enum for user roles
class UserRole(enum.Enum):
    ADMIN = "ADMIN"
    HEAD = "HEAD"
    TRAINER = "TRAINER"
    COACH = "COACH"
    LEARNER = "LEARNER"

# Enum for appointment status
class AppointmentStatus(str, enum.Enum):
    PENDING = "pending"           # Appointment requested, awaiting coach confirmation
    CONFIRMED = "confirmed"       # Coach confirmed the appointment
    CANCELLED = "cancelled"       # Cancelled by user or coach
    COMPLETED = "completed"       # Appointment finished
    NO_SHOW = "no_show"          # User didn't attend
    REJECTED = "rejected"         # Coach rejected the appointment

# Enums for specific fields - learner model
class CaesareanType(enum.Enum):
    ELECTIVE = "elective"
    EMERGENCY = "emergency"


class ConceptionType(enum.Enum):
    NATURAL = "natural"
    IVF = "ivf"
    IUI = "iui"
    SURROGACY = "surrogacy"
    UNKNOWN = "unknown"


class ReferenceDataType(enum.Enum):
    LINK = "link"
    PDF = "pdf"
    IMAGE = "image"
    VIDEO = "video"
    DOCX = "docx"


# --- NEW: The Central User Table ---
class User(Base):
    """
    Central table for all users. Stores login and role information.
    """

    __tablename__ = "users"

    # Core login fields
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=True)  # Good for password resets
    passcode = Column(
        String(255), unique=True, nullable=False, index=True
    )  # Encrypted passcode (Fernet) - decrypt via API for admin display
    passcode_hash = Column(
        String(60), nullable=False, index=True
    )  # Bcrypt hash for verification (e.g., "$2b$12$...")
    role = Column(SAEnum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

    # --- One-to-One Relationships to Profiles ---
    # A user will only have ONE of these relationships active, based on their role.

    head_profile = relationship(
        "HeadProfile",
        back_populates="user",
        foreign_keys="HeadProfile.user_id",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    trainer_profile = relationship(
        "TrainerProfile",
        back_populates="user",
        foreign_keys="TrainerProfile.user_id",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    coach_profile = relationship(
        "CoachProfile",
        back_populates="user",
        foreign_keys="CoachProfile.user_id",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    learner_profile = relationship(
        "LearnerProfile",
        back_populates="user",
        foreign_keys="LearnerProfile.user_id",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Relationship for tracking who created whom (e.g., Admins creating Heads)
    created_heads = relationship("HeadProfile", foreign_keys="[HeadProfile.created_by_admin_id]")


# Admin user model (for backward compatibility during migration)
class Admin(Base):

    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    role = Column(String(20), default="admin")
    passcode = Column(String(20), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=func.now())


# HeadProfile user model (renamed from Head)
class HeadProfile(Base):

    __tablename__ = "head_profiles"

    # Primary Fields
    id = Column(Integer, primary_key=True, index=True)

    # --- Link to User Table (One-to-One) ---
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    user = relationship("User", back_populates="head_profile", foreign_keys=[user_id])

    # Contact & Personal Info
    age = Column(Integer)
    address = Column(Text)
    contact_no = Column(String(20))  # Must be unique per trainer/consultant
    qualification = Column(Text)
    experience = Column(Text)
    date_of_joining = Column(Date)

    # Additional Profile Fields
    experience_with_hurshbin = Column(Text)  # add int -- no text
    interest = Column(Text)
    self_description = Column(Text)
    future_vision = Column(Text)
    number_of_sessions_done = Column(Integer, default=0)
    head_description = Column(Text)
    learners_guardian_description = Column(Text)
    input_at_hurshbin = Column(Text)
    note_box = Column(Text)
    message_box = Column(Text)

    # Foreign Keys & Timestamps
    created_by_admin_id = Column(Integer, ForeignKey("users.id"))  # Admin who created this head
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    created_by_admin = relationship(
        "User", foreign_keys=[created_by_admin_id], overlaps="created_heads"
    )
    trainers_created = relationship("TrainerProfile", back_populates="created_by_head")
    learners_created = relationship("LearnerProfile", back_populates="created_by_head")
    reference_data = relationship(
        "HeadReferenceData", back_populates="head", cascade="all, delete-orphan"
    )


# Trainer user model
class TrainerProfile(Base):

    __tablename__ = "trainer_profiles"

    # Primary Fields
    id = Column(Integer, primary_key=True, index=True)

    # --- Link to User Table (One-to-One) ---
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    user = relationship("User", back_populates="trainer_profile", foreign_keys=[user_id])

    # Contact & Personal Info
    age = Column(Integer)
    address = Column(Text)
    contact_no = Column(String(20))  # Must be unique
    qualification = Column(Text)
    experience = Column(Text)
    date_of_joining = Column(Date)

    qualification = Column(Text)
    experience = Column(Text)
    date_of_joining = Column(Date)

    # Additional Profile Fields
    experience_with_hurshbin = Column(Text)
    interest = Column(Text)
    self_description = Column(Text)
    future_vision = Column(Text)
    number_of_sessions_done = Column(Integer, default=0)
    head_description = Column(Text)
    learners_guardian_description = Column(Text)
    input_at_hurshbin = Column(Text)
    note_box = Column(Text)
    message_box = Column(Text)

    # Foreign Keys & Timestamps
    created_by_head_id = Column(
        Integer, ForeignKey("head_profiles.id")
    )  # Head who created this trainer
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    created_by_head = relationship("HeadProfile", back_populates="trainers_created")
    reference_data = relationship(
        "TrainerReferenceData", back_populates="trainer", cascade="all, delete-orphan"
    )


# Coach user model (formerly Consultant)
class CoachProfile(Base):

    __tablename__ = "coach_profiles"

    # Primary Fields
    id = Column(Integer, primary_key=True, index=True)

    # --- Link to User Table (One-to-One) ---
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    user = relationship("User", back_populates="coach_profile", foreign_keys=[user_id])

    # Contact & Personal Info
    age = Column(Integer)
    address = Column(Text)
    contact_no = Column(String(20))  # Must be unique
    qualification = Column(Text)
    experience = Column(Text)
    date_of_joining = Column(Date)

    # Additional Profile Fields
    experience_with_hurshbin = Column(Text)
    interest = Column(Text)
    self_description = Column(Text)
    future_vision = Column(Text)
    number_of_sessions_done = Column(Integer, default=0)
    head_description = Column(Text)
    learners_guardian_description = Column(Text)
    input_at_hurshbin = Column(Text)
    note_box = Column(Text)
    message_box = Column(Text)

    # NEW COACH SPECIFIC FIELDS
    # Availability: JSON string of available days (Monday-Friday)
    availability_days = Column(String(50))  # e.g., "Monday,Wednesday,Friday"
    
    # Time Slots: JSON string of available slots (10am, 1pm, 3pm, 5pm)
    time_slots = Column(String(100))  # e.g., "10am,1pm,3pm,5pm"
    
    # Specialization
    specialization = Column(Text)
    
    # Profile picture URL (local or S3)
    profile_picture_url = Column(String(500))
    
    # Availability Status - Coach can mark themselves as available/unavailable
    is_available = Column(Boolean, default=True)  # Can accept new appointments/sessions
    unavailable_until = Column(DateTime, nullable=True)  # Optional: block until specific date/time
    unavailable_reason = Column(String(255))  # e.g., "On leave", "Fully booked", "Personal"

    # Timestamps
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    reference_data = relationship(
        "CoachReferenceData", back_populates="coach", cascade="all, delete-orphan"
    )


# Learner user model


class LearnerProfile(Base):
    __tablename__ = "learner_profiles"

    # --- Personal details ---
    id = Column(Integer, primary_key=True, index=True)

    # --- Link to User Table (One-to-One) ---
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    user = relationship("User", back_populates="learner_profile", foreign_keys=[user_id])

    age = Column(Integer)
    dob = Column(Date)
    date_of_assessment = Column(Date)
    dlb_concerns_checklist = Column(Text)  # "A checklist of DLB concerns"
    personal_notes = Column(Text)

    # --- Delivery History ---
    mother_bed_rest = Column(Boolean)
    mother_bed_rest_duration = Column(String(255))
    mother_depressed_fearful = Column(Boolean)
    ultrasounds_performed = Column(Integer)
    was_premature = Column(Boolean)
    premature_weeks = Column(String(100))
    was_overdue = Column(Boolean)
    overdue_duration = Column(String(100))
    caesarean_delivery = Column(Boolean)
    caesarean_type = Column(SAEnum(CaesareanType))
    forceps_delivery = Column(Boolean)
    vacuum_delivery = Column(Boolean)
    very_fast_labor = Column(Boolean)
    induced_delivery = Column(Boolean)
    very_long_slow_labor = Column(Boolean)
    conception_type = Column(
        SAEnum(ConceptionType, values_callable=lambda obj: [e.value for e in obj])
    )
    was_adopted = Column(Boolean)
    adoption_age = Column(String(100))
    in_incubator = Column(Boolean)
    incubator_reason = Column(Text)
    had_jaundice = Column(Boolean)
    delivery_other_details = Column(Text)  # "Anything else?"

    # --- Medical History ---
    screamed_as_baby = Column(Boolean)
    difficult_sleep_pattern = Column(Boolean)
    struggled_changing_routines = Column(Boolean)
    difficulties_shifting_food = Column(Boolean)
    physical_milestones_achieved = Column(Boolean)
    vocal_language_milestones_achieved = Column(Boolean)
    major_illness_hospitalization = Column(Boolean)
    major_illness_details = Column(Text)
    specific_medical_details = Column(Text)

    # --- Learning history ---
    years_school_attended = Column(Integer)
    support_provided = Column(Text)
    current_grade = Column(String(100))
    current_learning_scenario = Column(Text)

    # --- History of intervention ---
    intervention_duration = Column(String(100))
    intervention_notes = Column(Text)

    # --- Assessment behaviour ---
    assessment_behaviour_notes = Column(Text)

    # --- Detailed skill development assessment ---
    skill_development_assessment = Column(Text)

    # --- Timestamps ---
    created_by_head_id = Column(Integer, ForeignKey("head_profiles.id"))
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # --- Relationship ---
    created_by_head = relationship("HeadProfile", back_populates="learners_created")
    # Connects to the LearnerReferenceData table
    reference_data = relationship(
        "LearnerReferenceData", back_populates="learner", cascade="all, delete-orphan"
    )


# --- Reference Data Table (File Uploads) ---


class LearnerReferenceData(Base):
    __tablename__ = "learner_reference_data"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)  # Path to S3/local storage
    file_type = Column(SAEnum(ReferenceDataType), nullable=False)

    # To distinguish between 'personal' or 'intervention' uploads
    category = Column(String(100))

    description = Column(Text)

    # Foreign Key
    learner_id = Column(Integer, ForeignKey("learner_profiles.id"), nullable=False, index=True)

    # Timestamps
    created_at = Column(DateTime, default=func.now())

    # Relationship
    learner = relationship("LearnerProfile", back_populates="reference_data")


# Reference Data Tables


class HeadReferenceData(Base):

    __tablename__ = "head_reference_data"

    id = Column(Integer, primary_key=True, index=True)
    head_id = Column(Integer, ForeignKey("head_profiles.id"), nullable=False)
    data_type = Column(SAEnum(ReferenceDataType), nullable=False)
    file_name = Column(String(255))
    file_path = Column(String(255), nullable=False)  # URL or file system path
    description = Column(Text)
    uploaded_at = Column(DateTime, default=func.now())

    # Relationships
    head = relationship("HeadProfile", back_populates="reference_data")


# Trainer Reference Data
class TrainerReferenceData(Base):

    __tablename__ = "trainer_reference_data"

    id = Column(Integer, primary_key=True, index=True)
    trainer_id = Column(Integer, ForeignKey("trainer_profiles.id"), nullable=False)
    data_type = Column(SAEnum(ReferenceDataType), nullable=False)
    file_name = Column(String(255))
    file_path = Column(String(255), nullable=False)  # URL or file system path
    description = Column(Text)
    uploaded_at = Column(DateTime, default=func.now())

    # Relationships
    trainer = relationship("TrainerProfile", back_populates="reference_data")


# Coach Reference Data
class CoachReferenceData(Base):

    __tablename__ = "coach_reference_data"

    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey("coach_profiles.id"), nullable=False)
    data_type = Column(SAEnum(ReferenceDataType), nullable=False)
    file_name = Column(String(255))
    file_path = Column(String(255), nullable=False)  # URL or file system path
    description = Column(Text)
    uploaded_at = Column(DateTime, default=func.now())

    # Relationships
    coach = relationship("CoachProfile", back_populates="reference_data")


# ===== APPOINTMENTS MODEL =====
class Appointment(Base):
    """
    Appointments table - Trainers, Learners, and Heads can schedule appointments with Coaches
    """
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    
    # Coach offering the appointment
    coach_id = Column(Integer, ForeignKey("coach_profiles.id"), nullable=False, index=True)
    
    # User scheduling the appointment (could be trainer, learner, or head)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user_role = Column(String(20), nullable=False)  # trainer, learner, head
    
    # Appointment Details
    scheduled_date = Column(Date, nullable=False)
    scheduled_time = Column(String(20), nullable=False)  # e.g., "10am", "1pm", "3pm", "5pm"
    status = Column(
        SAEnum(AppointmentStatus),
        default=AppointmentStatus.PENDING,
        nullable=False
    )
    
    # Additional info
    notes = Column(Text)
    
    # Payment and Session Info
    payment_receipt_url = Column(String(500), nullable=True)  # URL to payment screenshot
    session_type = Column(String(50), nullable=True)  # e.g., initial_consultation, follow_up
    
    # Rejection Info
    rejection_reason = Column(Text, nullable=True)  # Reason for rejecting the appointment
    refund_receipt_url = Column(String(500), nullable=True)  # URL to refund receipt/screenshot
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    coach = relationship("CoachProfile")
    user = relationship("User")


# ===== COACH SESSION MODEL =====
class CoachSession(Base):
    """
    Coach Sessions - Coaches can schedule sessions with multiple users (trainers, learners, heads)
    and optionally link to learning content
    """
    __tablename__ = "coach_sessions"

    id = Column(Integer, primary_key=True, index=True)
    
    # Coach conducting the session
    coach_id = Column(Integer, ForeignKey("coach_profiles.id"), nullable=False, index=True)
    
    # Session Details
    session_date = Column(Date, nullable=False)
    session_time = Column(String(20), nullable=False)  # e.g., "10am", "1pm", "3pm", "5pm"
    session_title = Column(String(255))
    
    # Optional learning content
    learning_content_id = Column(Integer, ForeignKey("learning_contents.id"), nullable=True)
    
    # Session info
    description = Column(Text)
    status = Column(String(20), default="scheduled")  # scheduled, ongoing, completed, cancelled
    notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    coach = relationship("CoachProfile")
    participants = relationship("CoachSessionParticipant", cascade="all, delete-orphan")


# ===== COACH SESSION PARTICIPANTS MODEL =====
class CoachSessionParticipant(Base):
    """
    Participants in a coach session (many-to-many relationship)
    """
    __tablename__ = "coach_session_participants"

    id = Column(Integer, primary_key=True, index=True)
    
    # Reference to the session
    session_id = Column(Integer, ForeignKey("coach_sessions.id"), nullable=False, index=True)
    
    # Participant (could be trainer, learner, or head)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Participant role
    participant_role = Column(String(20), nullable=False)  # trainer, learner, head
    
    # Attendance status
    status = Column(String(20), default="invited")  # invited, accepted, declined, attended
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    session = relationship("CoachSession", back_populates="participants")
    user = relationship("User")
