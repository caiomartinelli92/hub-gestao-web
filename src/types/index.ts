// ── Enums ─────────────────────────────────────────────────────────────────────

export enum Role {
  CEO = 'CEO',
  PO = 'PO',
  DEV = 'DEV',
  QA = 'QA',
  ADM = 'ADM',
}

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ProjectHealth {
  ON_TRACK = 'ON_TRACK',
  AT_RISK = 'AT_RISK',
  CRITICAL = 'CRITICAL',
}

export enum ScopeItemType {
  EPIC = 'EPIC',
  FEATURE = 'FEATURE',
  STORY = 'STORY',
  TASK = 'TASK',
}

export enum ScopeItemStatus {
  BACKLOG = 'BACKLOG',
  IN_SPRINT = 'IN_SPRINT',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  READY_FOR_QA = 'READY_FOR_QA',
  DONE = 'DONE',
}

export enum SprintStatus {
  FUTURE = 'FUTURE',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum BugSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum BugStatus {
  OPEN = 'OPEN',
  IN_CORRECTION = 'IN_CORRECTION',
  FIXED = 'FIXED',
  IN_RETEST = 'IN_RETEST',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
  WONT_FIX = 'WONT_FIX',
}

export enum CRStatus {
  DRAFT = 'DRAFT',
  SENT_TO_CLIENT = 'SENT_TO_CLIENT',
  CLIENT_APPROVED = 'CLIENT_APPROVED',
  CLIENT_REJECTED = 'CLIENT_REJECTED',
  APPROVED = 'APPROVED',
  CANCELLED = 'CANCELLED',
}

export enum MeetingStatus {
  SCHEDULED = 'SCHEDULED',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  mustChangePassword: boolean;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

// ── Projects ──────────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  status: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  client?: Client;
  poId: string;
  po?: User;
  techLeadId?: string;
  techLead?: User;
  status: ProjectStatus;
  health: ProjectHealth;
  startDate: string;
  endDate: string;
  budget?: number;
  driveFolderId?: string;
  googleCalendarId?: string;
  createdAt: string;
  updatedAt: string;
  members?: ProjectMember[];
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  user?: User;
  role: Role;
  joinedAt: string;
}

// ── Scope ─────────────────────────────────────────────────────────────────────

export interface AcceptanceCriteria {
  id: string;
  description: string;
  order: number;
}

export interface ScopeItem {
  id: string;
  projectId: string;
  type: ScopeItemType;
  title: string;
  description?: string;
  status: ScopeItemStatus;
  taskStatus?: TaskStatus;
  storyPoints?: number;
  order: number;
  parentId?: string;
  parent?: ScopeItem;
  sprintId?: string;
  sprint?: Sprint;
  assigneeId?: string;
  assignee?: User;
  isProductionBug: boolean;
  acceptanceCriteria?: AcceptanceCriteria[];
  children?: ScopeItem[];
  createdAt: string;
  updatedAt: string;
}

// ── Sprints ───────────────────────────────────────────────────────────────────

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  status: SprintStatus;
  velocity?: number;
  startedAt?: string;
  closedAt?: string;
  createdAt: string;
}

// ── Bugs ──────────────────────────────────────────────────────────────────────

export interface Bug {
  id: string;
  projectId: string;
  taskId?: string;
  title: string;
  description?: string;
  severity: BugSeverity;
  type: string;
  environment: string;
  origin: string;
  status: BugStatus;
  evidenceUrl?: string;
  cycleCount: number;
  reporterId: string;
  reporter?: User;
  assigneeId?: string;
  assignee?: User;
  closedAt?: string;
  createdAt: string;
  comments?: BugComment[];
}

export interface BugComment {
  id: string;
  content: string;
  authorId: string;
  author?: User;
  createdAt: string;
}

// ── Change Requests ───────────────────────────────────────────────────────────

export interface ChangeRequest {
  id: string;
  projectId: string;
  number: number;
  title: string;
  description: string;
  scopeImpact: string;
  timeImpact: string;
  costImpact: number;
  status: CRStatus;
  createdById: string;
  createdBy?: User;
  publicToken?: string;
  tokenExpiresAt?: string;
  clientDecision?: string;
  clientRespondedAt?: string;
  createdAt: string;
}

// ── Meetings ──────────────────────────────────────────────────────────────────

export interface Meeting {
  id: string;
  projectId: string;
  title: string;
  type: string;
  status: MeetingStatus;
  scheduledAt: string;
  endsAt: string;
  location?: string;
  agenda?: string;
  createdById: string;
  createdBy?: User;
  participants?: { userId: string; user?: User }[];
  minutes?: MeetingMinutes;
  createdAt: string;
}

export interface MeetingMinutes {
  id: string;
  meetingId: string;
  decisions: string;
  notes?: string;
  pendencies?: MinutePendency[];
}

export interface MinutePendency {
  id: string;
  description: string;
  assigneeId: string;
  assignee?: User;
  dueDate?: string;
  done: boolean;
}
