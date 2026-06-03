export interface Session {
  id: string;
  title: string;
  order: number;
  createdAt: number;
}

export interface Room {
  id: string;
  title: string;
  description: string;
  code: string;
  isOpen: boolean;
  createdAt: number;
  settings: RoomSettings;
  sessions: Record<string, Omit<Session, "id">>;
  // null=全停止, "ALL"=全セッション受付, sessionId=特定セッションのみ
  activeSessionId: string | null;
}

// 会社名（必須）/名前（必須）
// 会社名（必須）/名前（任意）
// 会社名（任意）/名前（任意）
// 匿名
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
