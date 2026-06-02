export interface Room {
  id: string;
  title: string;
  description: string;
  code: string;
  isOpen: boolean;
  createdAt: number;
  settings: RoomSettings;
}

export type AuthorMode = "anonymous" | "name" | "company" | "name_company";
export type QuestionStatus = "pending" | "approved" | "rejected";

export interface RoomSettings {
  authorMode: AuthorMode;
  nameLabel: string;
  slackWebhookUrl: string;
  requireApproval: boolean;
}

export interface Question {
  id: string;
  roomId: string;
  text: string;
  authorName: string | null;
  likes: number;
  likedBy: Record<string, boolean>;
  status: QuestionStatus;
  isAnswered: boolean;
  isHidden: boolean;
  createdAt: number;
  sessionId: string;
}

export type QuestionInput = Pick<Question, "text" | "authorName">;
