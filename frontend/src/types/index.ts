export interface Client {
  id: string;
  org_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  language: string;
  gender: string | null;
  household_size: number | null;
  status: "active" | "inactive" | "archived";
  extra_fields: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientListItem extends Client {
  last_service_date: string | null;
}

export interface ServiceEntry {
  id: string;
  org_id: string;
  client_id: string;
  staff_id: string;
  service_date: string;
  service_type: string;
  notes: string | null;
  summary: string | null;
  action_items: string[];
  risk_flags: string[];
  language: string;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  org_id: string;
  client_id: string;
  service_entry_id: string | null;
  assigned_to: string | null;
  description: string;
  category: string | null;
  urgency: "low" | "medium" | "high" | "critical";
  due_date: string | null;
  status: "pending" | "completed" | "dismissed";
  completed_at: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  org_id: string;
  full_name: string;
  email: string;
  role: "volunteer" | "staff" | "admin";
  avatar_url: string | null;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  per_page: number;
  items: T[];
}

export interface ClientListResponse {
  clients: ClientListItem[];
  total: number;
  page: number;
  per_page: number;
}

export interface ServiceEntryListResponse {
  entries: ServiceEntry[];
  total: number;
  page: number;
  per_page: number;
}
