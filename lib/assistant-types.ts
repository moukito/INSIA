import type { EmailCategory } from "@/lib/email-classifier";

export type AssistantPriority = "Urgent" | "Normal" | "Faible";

export interface AssistantEmail {
  id: number;
  subject: string;
  from: string;
  fromAddress: string;
  to?: string;
  date: string | null;
  unread: boolean;
  category: EmailCategory;
}

export interface AssistantEmailAttachment extends AssistantEmail {
  body?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
}

export interface AssistantTask {
  id: number;
  title: string;
  course: string;
  due: string;
  priority: AssistantPriority;
  done: boolean;
  instructions?: string;
  estimatedTime?: string;
}

export interface AssistantScheduleItem {
  id: number;
  eventId?: number;
  title: string;
  type: "cours" | "association" | "personnel";
  organizer: string;
  time: string;
  end: string;
  date: string;
  fullDate: string;
  place: string;
  detail: string;
  badge: string;
  color: string;
  light: string;
  text: string;
}

export interface AssistantPendingScheduleChange {
  scheduleItemId?: number;
  emailId: number;
  emailSubject: string;
  emailDate: string | null;
  action: "create" | "update" | "cancel";
  changeType:
    | "add"
    | "reschedule"
    | "time_change"
    | "room_change"
    | "other"
    | "cancel";
  summary: string;
  before?: AssistantScheduleItem;
  after?: AssistantScheduleItem;
}

export interface AssistantToolUse {
  name: string;
  success: boolean;
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  emails?: AssistantEmailAttachment[];
  tasks?: AssistantTask[];
  pendingActions?: AssistantPendingAction[];
  pendingScheduleChanges?: AssistantPendingScheduleChange[];
  toolUses?: AssistantToolUse[];
}

export interface AssistantPendingAction {
  type: "delete_task";
  id: number;
  title: string;
}
