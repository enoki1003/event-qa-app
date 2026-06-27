export interface Session {
  id: string;
  title: string;
  description: string;
  order: number;
  createdAt: number;
}

export interface Room {
  id: string;
  title: string;
  description: string;
  code: string;
  isOpen: boolean;
  eventDate: string;
  eventTime: string;
  createdAt: number;
  settings: RoomSettings;
  sessions: Record<string, Omit<Session, "id">>;
  activeSessionId: string | null;
}

export type AuthorMode =
  | "anonymous"
  | "both_required"
  | "company_req_name_opt"
  | "both_optional";

export type QuestionStatus = "pending" | "approved" | "rejected";

export interface RoomSettings {
  authorMode: AuthorMode;
  slackWebhookUrl: string;
  requireApproval: boolean;
  showTimestamp: boolean;
  replyAuthorLabel: string;
  ctaLabel: string;
  ctaUrl: string;
  surveyLabel: string;
  surveyUrl: string;
}

export interface Reply {
  id: string;
  text: string;
  isPrivate: boolean;
  createdAt: number;
}

export interface Question {
  id: string;
  roomId: string;
  text: string;
  companyName: string | null;
  authorName: string | null;
  likes: number;
  likedBy: Record<string, boolean>;
  status: QuestionStatus;
  isAnswered: boolean;
  isHidden: boolean;
  createdAt: number;
  sessionId: string | null;
  sessionTitle: string | null;
  browserSessionId: string;
  replies: Record<string, Omit<Reply, "id">>;
}

export type QuestionInput = Pick<Question, "text" | "companyName" | "authorName">;

export interface Visitor {
  sessionId: string;
  firstAccessAt: number;
  companyName: string | null;
  authorName: string | null;
}

export type PollStatus = "draft" | "active" | "closed";

export interface Poll {
  id: string;
  title: string;
  options: string[]; // max 5
  status: PollStatus;
  allowMultiple: boolean;
  order: number;
  createdAt: number;
  votes: Record<string, number[]>; // browserSessionId -> selected option indices
}
