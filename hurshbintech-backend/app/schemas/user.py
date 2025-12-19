"""
User schemas for CRUD operations
"""

import enum
import json
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, field_validator


# ============ ENUMERATIONS ============
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


# ============ ADMIN SCHEMAS ============
# Schema for admin response
class AdminResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    passcode: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============ HEAD SCHEMAS ============


class HeadCreate(BaseModel):
    """Schema for creating a new head"""

    name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    passcode: Optional[str] = None  # Auto-generated if not provided
    address: Optional[str] = None
    contact_no: Optional[str] = None
    qualification: Optional[str] = None
    experience: Optional[str] = None
    date_of_joining: Optional[date] = None
    experience_with_hurshbin: Optional[str] = None
    interest: Optional[str] = None
    self_description: Optional[str] = None
    future_vision: Optional[str] = None
    number_of_sessions_done: Optional[int] = None
    head_description: Optional[str] = None
    learners_guardian_description: Optional[str] = None
    input_at_hurshbin: Optional[str] = None
    note_box: Optional[str] = None
    message_box: Optional[str] = None


class HeadUpdate(BaseModel):
    """Schema for updating head profile"""

    name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    address: Optional[str] = None
    contact_no: Optional[str] = None
    qualification: Optional[str] = None
    experience: Optional[str] = None
    date_of_joining: Optional[date] = None
    experience_with_hurshbin: Optional[str] = None
    interest: Optional[str] = None
    self_description: Optional[str] = None
    future_vision: Optional[str] = None
    number_of_sessions_done: Optional[int] = None
    head_description: Optional[str] = None
    learners_guardian_description: Optional[str] = None
    input_at_hurshbin: Optional[str] = None
    note_box: Optional[str] = None
    message_box: Optional[str] = None


class HeadResponse(BaseModel):
    """Schema for head response - combines User and Profile data"""

    id: int  # Profile ID
    user_id: int  # From Profile - needed for reveal passcode endpoint
    name: str  # From User
    email: Optional[str] = None  # From User
    role: str  # From User
    passcode: str  # From User
    age: Optional[int] = None
    address: Optional[str] = None
    contact_no: Optional[str] = None
    qualification: Optional[str] = None
    experience: Optional[str] = None
    date_of_joining: Optional[date] = None

    # Additional Profile Fields
    experience_with_hurshbin: Optional[str] = None
    interest: Optional[str] = None
    self_description: Optional[str] = None
    future_vision: Optional[str] = None
    number_of_sessions_done: Optional[int] = 0
    head_description: Optional[str] = None
    learners_guardian_description: Optional[str] = None
    input_at_hurshbin: Optional[str] = None
    note_box: Optional[str] = None
    message_box: Optional[str] = None

    created_by: Optional[int] = None
    created_at: datetime  # From User

    @classmethod
    def from_orm_with_user(cls, profile, user=None):
        """Create response from Profile with User data"""
        if user is None:
            user = profile.user

        # Use plaintext passcode if available (during creation), otherwise use encrypted version
        passcode = getattr(profile, 'plaintext_passcode', user.passcode)

        data = {
            "id": profile.id,
            "user_id": profile.user_id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "passcode": passcode,
            "created_at": user.created_at,
            "created_by": profile.created_by_admin_id,
            # Profile fields
            **{
                field: getattr(profile, field)
                for field in [
                    "age",
                    "address",
                    "contact_no",
                    "qualification",
                    "experience",
                    "date_of_joining",
                    "experience_with_hurshbin",
                    "interest",
                    "self_description",
                    "future_vision",
                    "number_of_sessions_done",
                    "head_description",
                    "learners_guardian_description",
                    "input_at_hurshbin",
                    "note_box",
                    "message_box",
                ]
                if hasattr(profile, field)
            },
        }
        return cls(**data)

    class Config:
        from_attributes = True


# ============ TRAINER SCHEMAS ============


class TrainerCreate(BaseModel):
    """Schema for creating a new trainer"""

    name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    passcode: Optional[str] = None  # Auto-generated if not provided
    address: Optional[str] = None
    contact_no: Optional[str] = None
    qualification: Optional[str] = None
    experience: Optional[str] = None
    date_of_joining: Optional[date] = None
    experience_with_hurshbin: Optional[str] = None
    interest: Optional[str] = None
    self_description: Optional[str] = None
    future_vision: Optional[str] = None
    number_of_sessions_done: Optional[int] = None
    head_description: Optional[str] = None
    learners_guardian_description: Optional[str] = None
    input_at_hurshbin: Optional[str] = None
    note_box: Optional[str] = None
    message_box: Optional[str] = None


class TrainerUpdate(BaseModel):
    """Schema for updating trainer profile"""

    name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    address: Optional[str] = None
    contact_no: Optional[str] = None
    qualification: Optional[str] = None
    experience: Optional[str] = None
    date_of_joining: Optional[date] = None
    experience_with_hurshbin: Optional[str] = None
    interest: Optional[str] = None
    self_description: Optional[str] = None
    future_vision: Optional[str] = None
    number_of_sessions_done: Optional[int] = None
    head_description: Optional[str] = None
    learners_guardian_description: Optional[str] = None
    input_at_hurshbin: Optional[str] = None
    note_box: Optional[str] = None
    message_box: Optional[str] = None


class TrainerResponse(BaseModel):
    """Schema for trainer response - combines User and Profile data"""

    id: int  # Profile ID
    user_id: int  # User ID from users table
    name: str  # From User
    email: Optional[str] = None  # From User
    role: str  # From User
    passcode: str  # From User
    age: Optional[int] = None
    address: Optional[str] = None
    contact_no: Optional[str] = None
    qualification: Optional[str] = None
    experience: Optional[str] = None
    date_of_joining: Optional[date] = None

    # Additional Profile Fields
    experience_with_hurshbin: Optional[str] = None
    interest: Optional[str] = None
    self_description: Optional[str] = None
    future_vision: Optional[str] = None
    number_of_sessions_done: Optional[int] = 0
    head_description: Optional[str] = None
    learners_guardian_description: Optional[str] = None
    input_at_hurshbin: Optional[str] = None
    note_box: Optional[str] = None
    message_box: Optional[str] = None

    created_by: Optional[int] = None
    created_at: datetime  # From User

    @classmethod
    def from_orm_with_user(cls, profile, user=None):
        """Create response from Profile with User data"""
        if user is None:
            user = profile.user

        # Use plaintext passcode if available (during creation), otherwise use encrypted version
        passcode = getattr(profile, 'plaintext_passcode', user.passcode)

        data = {
            "id": profile.id,
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "passcode": passcode,
            "created_at": user.created_at,
            "created_by": profile.created_by_head_id,
            # Profile fields
            **{
                field: getattr(profile, field)
                for field in [
                    "age",
                    "address",
                    "contact_no",
                    "qualification",
                    "experience",
                    "date_of_joining",
                    "experience_with_hurshbin",
                    "interest",
                    "self_description",
                    "future_vision",
                    "number_of_sessions_done",
                    "head_description",
                    "learners_guardian_description",
                    "input_at_hurshbin",
                    "note_box",
                    "message_box",
                ]
                if hasattr(profile, field)
            },
        }
        return cls(**data)

    class Config:
        from_attributes = True


# ============ COACH SCHEMAS ============


class CoachCreate(BaseModel):
    """Schema for creating a new coach"""

    name: str
    email: Optional[str] = None
    passcode: Optional[str] = None  # Auto-generated if not provided
    age: Optional[int] = None
    address: Optional[str] = None
    contact_no: Optional[str] = None
    qualification: Optional[str] = None
    experience: Optional[str] = None
    date_of_joining: Optional[date] = None
    
    # Coach specific fields
    availability_days: Optional[str] = None  # e.g., "Monday,Wednesday,Friday"
    time_slots: Optional[str] = None  # e.g., "10am,1pm,3pm,5pm"
    specialization: Optional[str] = None
    profile_picture_url: Optional[str] = None


class CoachUpdate(BaseModel):
    """Schema for updating coach profile"""

    name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    address: Optional[str] = None
    contact_no: Optional[str] = None
    qualification: Optional[str] = None
    experience: Optional[str] = None
    date_of_joining: Optional[date] = None
    experience_with_hurshbin: Optional[str] = None
    interest: Optional[str] = None
    self_description: Optional[str] = None
    future_vision: Optional[str] = None
    note_box: Optional[str] = None
    message_box: Optional[str] = None
    
    # Coach specific fields
    availability_days: Optional[str] = None  # e.g., "Monday,Wednesday,Friday"
    time_slots: Optional[str] = None  # e.g., "10am,1pm,3pm,5pm"
    specialization: Optional[str] = None
    profile_picture_url: Optional[str] = None
    is_available: Optional[bool] = None
    unavailable_until: Optional[datetime] = None
    unavailable_reason: Optional[str] = None


class CoachResponse(BaseModel):
    """Schema for coach response - combines User and Profile data"""

    id: int  # Profile ID
    user_id: int  # User ID from users table
    name: str  # From User
    email: Optional[str] = None  # From User
    role: str  # From User
    passcode: str  # From User
    age: Optional[int] = None
    address: Optional[str] = None
    contact_no: Optional[str] = None
    qualification: Optional[str] = None
    experience: Optional[str] = None
    date_of_joining: Optional[date] = None
    experience_with_hurshbin: Optional[str] = None
    interest: Optional[str] = None
    self_description: Optional[str] = None
    future_vision: Optional[str] = None
    number_of_sessions_done: Optional[int] = 0
    head_description: Optional[str] = None
    learners_guardian_description: Optional[str] = None
    input_at_hurshbin: Optional[str] = None
    note_box: Optional[str] = None
    message_box: Optional[str] = None
    
    # Coach specific fields
    availability_days: Optional[str] = None
    time_slots: Optional[str] = None
    specialization: Optional[str] = None
    profile_picture_url: Optional[str] = None
    is_available: Optional[bool] = True
    unavailable_until: Optional[datetime] = None
    unavailable_reason: Optional[str] = None
    
    created_at: datetime  # From User

    @classmethod
    def from_orm_with_user(cls, profile, user=None):
        """Create response from Profile with User data"""
        if user is None:
            user = profile.user

        # Use plaintext passcode if available (during creation), otherwise use encrypted version
        passcode = getattr(profile, 'plaintext_passcode', user.passcode)

        data = {
            "id": profile.id,
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "passcode": passcode,
            "created_at": user.created_at,
            # Profile fields
            **{
                field: getattr(profile, field)
                for field in [
                    "age",
                    "address",
                    "contact_no",
                    "qualification",
                    "experience",
                    "date_of_joining",
                    "experience_with_hurshbin",
                    "interest",
                    "self_description",
                    "future_vision",
                    "number_of_sessions_done",
                    "head_description",
                    "learners_guardian_description",
                    "input_at_hurshbin",
                    "note_box",
                    "message_box",
                    "availability_days",
                    "time_slots",
                    "specialization",
                    "profile_picture_url",
                    "is_available",
                    "unavailable_until",
                    "unavailable_reason",
                ]
                if hasattr(profile, field)
            },
        }
        return cls(**data)

    class Config:
        from_attributes = True


# =========== LEARNER SCHEMAS ============
# Learner schemas
class LearnerCreate(BaseModel):
    """Schema for creating a new learner"""

    # --- Personal details ---
    name: str  # Name is required
    email: Optional[str] = None
    passcode: Optional[str] = None  # Auto-generated if not provided
    age: Optional[int] = None
    dob: Optional[date] = None
    date_of_assessment: Optional[date] = None
    dlb_concerns_checklist: Optional[str] = None  # Will store JSON string
    personal_notes: Optional[str] = None

    @field_validator("dlb_concerns_checklist", mode="before")
    @classmethod
    def validate_checklist(cls, v):
        """Convert list to JSON string for storage"""
        if v is None:
            return None
        if isinstance(v, list):
            return json.dumps(v)  # Convert list to JSON string
        if isinstance(v, str):
            # If already a string, validate it's valid JSON
            try:
                json.loads(v)
                return v
            except json.JSONDecodeError:
                return json.dumps([])  # Return empty array if invalid
        return json.dumps([])  # Default empty array

    # --- Delivery History ---
    mother_bed_rest: Optional[bool] = None
    mother_bed_rest_duration: Optional[str] = None
    mother_depressed_fearful: Optional[bool] = None
    ultrasounds_performed: Optional[int] = None
    was_premature: Optional[bool] = None
    premature_weeks: Optional[str] = None
    was_overdue: Optional[bool] = None
    overdue_duration: Optional[str] = None
    caesarean_delivery: Optional[bool] = None
    caesarean_type: Optional[CaesareanType] = None
    forceps_delivery: Optional[bool] = None
    vacuum_delivery: Optional[bool] = None
    very_fast_labor: Optional[bool] = None
    induced_delivery: Optional[bool] = None
    very_long_slow_labor: Optional[bool] = None
    conception_type: Optional[ConceptionType] = None
    was_adopted: Optional[bool] = None
    adoption_age: Optional[str] = None
    in_incubator: Optional[bool] = None
    incubator_reason: Optional[str] = None
    had_jaundice: Optional[bool] = None
    delivery_other_details: Optional[str] = None

    # --- Medical History ---
    screamed_as_baby: Optional[bool] = None
    difficult_sleep_pattern: Optional[bool] = None
    struggled_changing_routines: Optional[bool] = None
    difficulties_shifting_food: Optional[bool] = None
    physical_milestones_achieved: Optional[bool] = None
    vocal_language_milestones_achieved: Optional[bool] = None
    major_illness_hospitalization: Optional[bool] = None
    major_illness_details: Optional[str] = None
    specific_medical_details: Optional[str] = None

    # --- Learning history ---
    years_school_attended: Optional[int] = None
    support_provided: Optional[str] = None
    current_grade: Optional[str] = None
    current_learning_scenario: Optional[str] = None

    # --- History of intervention ---
    intervention_duration: Optional[str] = None
    intervention_notes: Optional[str] = None

    # --- Assessment behaviour ---
    assessment_behaviour_notes: Optional[str] = None

    # --- Detailed skill development assessment ---
    skill_development_assessment: Optional[str] = None


class LearnerUpdate(BaseModel):
    """Schema for updating a learner's profile"""

    # --- Personal details ---
    name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    dob: Optional[date] = None
    date_of_assessment: Optional[date] = None
    dlb_concerns_checklist: Optional[str] = None  # Will store JSON string
    personal_notes: Optional[str] = None

    @field_validator("dlb_concerns_checklist", mode="before")
    @classmethod
    def validate_checklist(cls, v):
        """Convert list to JSON string for storage"""
        if v is None:
            return None
        if isinstance(v, list):
            return json.dumps(v)  # Convert list to JSON string
        if isinstance(v, str):
            # If already a string, validate it's valid JSON
            try:
                json.loads(v)
                return v
            except json.JSONDecodeError:
                return json.dumps([])  # Return empty array if invalid
        return json.dumps([])  # Default empty array

    # --- Delivery History ---
    mother_bed_rest: Optional[bool] = None
    mother_bed_rest_duration: Optional[str] = None
    mother_depressed_fearful: Optional[bool] = None
    ultrasounds_performed: Optional[int] = None
    was_premature: Optional[bool] = None
    premature_weeks: Optional[str] = None
    was_overdue: Optional[bool] = None
    overdue_duration: Optional[str] = None
    caesarean_delivery: Optional[bool] = None
    caesarean_type: Optional[CaesareanType] = None
    forceps_delivery: Optional[bool] = None
    vacuum_delivery: Optional[bool] = None
    very_fast_labor: Optional[bool] = None
    induced_delivery: Optional[bool] = None
    very_long_slow_labor: Optional[bool] = None
    conception_type: Optional[ConceptionType] = None
    was_adopted: Optional[bool] = None
    adoption_age: Optional[str] = None
    in_incubator: Optional[bool] = None
    incubator_reason: Optional[str] = None
    had_jaundice: Optional[bool] = None
    delivery_other_details: Optional[str] = None

    # --- Medical History ---
    screamed_as_baby: Optional[bool] = None
    difficult_sleep_pattern: Optional[bool] = None
    struggled_changing_routines: Optional[bool] = None
    difficulties_shifting_food: Optional[bool] = None
    physical_milestones_achieved: Optional[bool] = None
    vocal_language_milestones_achieved: Optional[bool] = None
    major_illness_hospitalization: Optional[bool] = None
    major_illness_details: Optional[str] = None
    specific_medical_details: Optional[str] = None

    # --- Learning history ---
    years_school_attended: Optional[int] = None
    support_provided: Optional[str] = None
    current_grade: Optional[str] = None
    current_learning_scenario: Optional[str] = None

    # --- History of intervention ---
    intervention_duration: Optional[str] = None
    intervention_notes: Optional[str] = None

    # --- Assessment behaviour ---
    assessment_behaviour_notes: Optional[str] = None

    # --- Detailed skill development assessment ---
    skill_development_assessment: Optional[str] = None


class LearnerResponse(BaseModel):
    """Schema for learner response"""

    # --- Personal details ---
    id: int
    user_id: int  # User ID from users table
    name: str
    email: Optional[str] = None  # From User
    passcode: str
    age: Optional[int] = None
    dob: Optional[date] = None
    date_of_assessment: Optional[date] = None
    dlb_concerns_checklist: Optional[List[str]] = None  # Return list to frontend
    personal_notes: Optional[str] = None

    # --- Delivery History ---
    mother_bed_rest: Optional[bool] = None
    mother_bed_rest_duration: Optional[str] = None
    mother_depressed_fearful: Optional[bool] = None
    ultrasounds_performed: Optional[int] = None
    was_premature: Optional[bool] = None
    premature_weeks: Optional[str] = None
    was_overdue: Optional[bool] = None
    overdue_duration: Optional[str] = None
    caesarean_delivery: Optional[bool] = None
    caesarean_type: Optional[str] = None  # Changed from CaesareanType to str
    forceps_delivery: Optional[bool] = None
    vacuum_delivery: Optional[bool] = None
    very_fast_labor: Optional[bool] = None
    induced_delivery: Optional[bool] = None
    very_long_slow_labor: Optional[bool] = None
    conception_type: Optional[str] = None  # Changed from ConceptionType to str
    was_adopted: Optional[bool] = None
    adoption_age: Optional[str] = None
    in_incubator: Optional[bool] = None
    incubator_reason: Optional[str] = None
    had_jaundice: Optional[bool] = None
    delivery_other_details: Optional[str] = None

    # --- Medical History ---
    screamed_as_baby: Optional[bool] = None
    difficult_sleep_pattern: Optional[bool] = None
    struggled_changing_routines: Optional[bool] = None
    difficulties_shifting_food: Optional[bool] = None
    physical_milestones_achieved: Optional[bool] = None
    vocal_language_milestones_achieved: Optional[bool] = None
    major_illness_hospitalization: Optional[bool] = None
    major_illness_details: Optional[str] = None
    specific_medical_details: Optional[str] = None

    # --- Learning history ---
    years_school_attended: Optional[int] = None
    support_provided: Optional[str] = None
    current_grade: Optional[str] = None
    current_learning_scenario: Optional[str] = None

    # --- History of intervention ---
    intervention_duration: Optional[str] = None
    intervention_notes: Optional[str] = None

    # --- Assessment behaviour ---
    assessment_behaviour_notes: Optional[str] = None

    # --- Detailed skill development assessment ---
    skill_development_assessment: Optional[str] = None

    # --- Timestamps & FKs ---
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_with_user(cls, profile, user=None):
        """Create response from Profile with User data"""
        if user is None:
            user = profile.user

        # Use plaintext passcode if available (during creation), otherwise use encrypted version
        passcode = getattr(profile, 'plaintext_passcode', user.passcode)

        # Build data dictionary with all profile fields
        data = {
            "id": profile.id,
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "passcode": passcode,
            "created_at": user.created_at,
            "updated_at": profile.updated_at,
            "created_by": profile.created_by_head_id,
        }

        # Add all other profile fields
        profile_fields = [
            "age",
            "dob",
            "date_of_assessment",
            "personal_notes",
            "mother_bed_rest",
            "mother_bed_rest_duration",
            "mother_depressed_fearful",
            "ultrasounds_performed",
            "was_premature",
            "premature_weeks",
            "was_overdue",
            "overdue_duration",
            "caesarean_delivery",
            "caesarean_type",
            "forceps_delivery",
            "vacuum_delivery",
            "very_fast_labor",
            "induced_delivery",
            "very_long_slow_labor",
            "conception_type",
            "was_adopted",
            "adoption_age",
            "in_incubator",
            "incubator_reason",
            "had_jaundice",
            "delivery_other_details",
            "screamed_as_baby",
            "difficult_sleep_pattern",
            "struggled_changing_routines",
            "difficulties_shifting_food",
            "physical_milestones_achieved",
            "vocal_language_milestones_achieved",
            "major_illness_hospitalization",
            "major_illness_details",
            "specific_medical_details",
            "years_school_attended",
            "support_provided",
            "current_grade",
            "current_learning_scenario",
            "intervention_duration",
            "intervention_notes",
            "assessment_behaviour_notes",
            "skill_development_assessment",
        ]

        for field in profile_fields:
            if hasattr(profile, field):
                data[field] = getattr(profile, field)

        # Convert dlb_concerns_checklist from JSON string to list
        if hasattr(profile, "dlb_concerns_checklist") and profile.dlb_concerns_checklist:
            try:
                data["dlb_concerns_checklist"] = json.loads(profile.dlb_concerns_checklist)
            except (json.JSONDecodeError, TypeError):
                data["dlb_concerns_checklist"] = []
        else:
            data["dlb_concerns_checklist"] = []

        return cls(**data)

    class Config:
        from_attributes = True


# ============ APPOINTMENT SCHEMAS ============


class AppointmentCreate(BaseModel):
    """Schema for creating a new appointment with a coach"""

    coach_id: int
    scheduled_date: date
    scheduled_time: str  # e.g., "10am", "1pm", "3pm", "5pm"
    notes: Optional[str] = None
    session_type: Optional[str] = None
    payment_receipt_url: Optional[str] = None


class AppointmentUpdate(BaseModel):
    """Schema for updating an appointment"""

    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    status: Optional[str] = None  # scheduled, confirmed, cancelled, completed
    notes: Optional[str] = None
    session_type: Optional[str] = None
    payment_receipt_url: Optional[str] = None
    rejection_reason: Optional[str] = None
    refund_receipt_url: Optional[str] = None


class AppointmentResponse(BaseModel):
    """Schema for appointment response"""

    id: int
    coach_id: int
    user_id: int
    user_role: str
    scheduled_date: str  # Changed to str to ensure proper JSON serialization
    scheduled_time: str
    status: str
    notes: Optional[str] = None
    user_name: Optional[str] = None
    session_type: Optional[str] = None
    payment_screenshot_url: Optional[str] = None
    payment_receipt_url: Optional[str] = None
    rejection_reason: Optional[str] = None
    refund_receipt_url: Optional[str] = None
    created_at: str  # Changed to str for consistent serialization
    updated_at: str  # Changed to str for consistent serialization

    class Config:
        from_attributes = True
        json_encoders = {
            date: lambda v: v.isoformat() if v else None,
            datetime: lambda v: v.isoformat() if v else None,
        }


class AvailableSlotsResponse(BaseModel):
    """Schema for available time slots response"""
    
    coach_id: int
    date: date
    available_slots: List[str]  # e.g., ["10am", "1pm", "3pm"]
    all_slots: List[str]        # Coach's configured time slots
    booked_slots: List[str]     # Already booked time slots
    
    class Config:
        from_attributes = True


# ============ COACH SESSION SCHEMAS ============


class CoachSessionParticipantCreate(BaseModel):
    """Schema for adding a participant to a coach session"""

    user_id: int
    participant_role: str  # trainer, learner, head


class CoachSessionParticipantResponse(BaseModel):
    """Schema for coach session participant response"""

    id: int
    session_id: int
    user_id: int
    participant_role: str
    status: str  # invited, accepted, declined, attended
    created_at: datetime

    class Config:
        from_attributes = True


class CoachSessionCreate(BaseModel):
    """Schema for creating a new coach session"""

    session_date: date
    session_time: str  # e.g., "10am", "1pm", "3pm", "5pm"
    session_title: Optional[str] = None
    learning_content_id: Optional[int] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    learner_ids: Optional[List[int]] = []
    trainer_ids: Optional[List[int]] = []
    head_ids: Optional[List[int]] = []


class CoachSessionUpdate(BaseModel):
    """Schema for updating a coach session"""

    session_date: Optional[date] = None
    session_time: Optional[str] = None
    session_title: Optional[str] = None
    learning_content_id: Optional[int] = None
    description: Optional[str] = None
    status: Optional[str] = None  # scheduled, ongoing, completed, cancelled
    notes: Optional[str] = None


class CoachSessionResponse(BaseModel):
    """Schema for coach session response"""

    id: int
    coach_id: int
    session_date: date
    session_time: str
    session_title: Optional[str] = None
    learning_content_id: Optional[int] = None
    description: Optional[str] = None
    status: str
    notes: Optional[str] = None
    participants: List[CoachSessionParticipantResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
