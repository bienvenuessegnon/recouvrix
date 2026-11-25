from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


UserRoleLiteral = Literal["ADMIN", "MANAGER"]


class SafeUserOut(BaseModel):
    id: str
    organizationId: str
    email: str
    fullName: str
    role: UserRoleLiteral
    isActive: bool
    isDemo: bool
    createdAt: str
    updatedAt: str
    lastLoginAt: str | None = None


class AuthStatusOut(BaseModel):
    requiresInitialSetup: bool
    envDemoConfigured: bool


class BootstrapRequest(BaseModel):
    adminPassword: str = ""
    managerPassword: str = ""


class LoginRequest(BaseModel):
    email: str = ""
    password: str = ""


class LoginResponseOut(BaseModel):
    token: str
    expiresAt: str
    user: SafeUserOut


class MeResponseOut(BaseModel):
    user: SafeUserOut
    expiresAt: str


class AdminCreateUserRequest(BaseModel):
    fullName: str = Field(default="", max_length=200)
    email: str = Field(default="", max_length=255)
    role: str = ""
    password: str = ""


class AdminUpdateUserRequest(BaseModel):
    fullName: str | None = Field(default=None, max_length=200)
    role: str | None = None
    isActive: bool | None = None


class ResetDemoAccountsRequest(BaseModel):
    adminPassword: str = ""
    managerPassword: str = ""


class ActivityLogOut(BaseModel):
    id: str
    eventType: str
    category: str
    actorUserId: str | None = None
    actorLabel: str
    targetUserId: str | None = None
    targetLabel: str | None = None
    entityType: str | None = None
    entityId: str | None = None
    summary: str
    createdAt: str
