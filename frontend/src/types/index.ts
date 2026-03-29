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

export interface Appointment {
  id: string;
  org_id: string;
  client_id: string;
  staff_id: string;
  scheduled_at: string;
  duration_minutes: number;
  service_type: string | null;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientDocument {
  id: string;
  org_id: string;
  client_id: string;
  uploaded_by: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string;
  description: string | null;
  created_at: string;
}

export interface PhotoIntakeResult {
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  language: string | null;
  gender: string | null;
  household_size: number | null;
  status: string | null;
  extra_fields: Record<string, string | number | null>;
}

export interface TranscriptionResult {
  transcript: string;
}

export interface StructuredNoteResult {
  summary: string | null;
  service_type: string | null;
  action_items: string[];
  follow_up_date: string | null;
  risk_flag: boolean;
}

export interface SemanticSearchResult {
  service_entry_id: string;
  client_id: string;
  client_name: string;
  service_date: string;
  service_type: string;
  content_snippet: string;
  similarity: number;
}

export interface SemanticSearchResponse {
  query: string;
  results: SemanticSearchResult[];
}

export interface ClientSummaryStructured {
  background: string | null;
  services_history: string[];
  current_status: string | null;
  active_needs: string[];
  risk_factors: string[];
  next_steps: string[];
}

export interface ClientSummary {
  id: string;
  org_id: string;
  client_id: string;
  generated_by: string;
  summary_text: string;
  summary_structured: ClientSummaryStructured | null;
  created_at: string;
}

export interface ClientSummaryDraft {
  summary_text: string;
  summary_structured: ClientSummaryStructured;
}

export interface AuditLogEntry {
  id: string;
  org_id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
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

export interface CustomFieldDefinition {
  key: string;
  label: string;
  field_type: "text" | "textarea" | "number" | "date" | "select";
  required: boolean;
  options: string[];
}

export interface OrgConfig {
  org_id: string;
  extra_fields_schema: CustomFieldDefinition[];
  service_types: string[];
  ai_features_enabled: Record<string, boolean>;
  ai_monthly_budget_cents: number;
  created_at: string;
  updated_at: string;
}

export interface ClientImportRowError {
  row_number: number;
  errors: string[];
  row_data: Record<string, string>;
}

export interface ClientImportResponse {
  inserted_count: number;
  failed_count: number;
  errors: ClientImportRowError[];
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

export interface AppointmentListResponse {
  appointments: Appointment[];
  total: number;
  page: number;
  per_page: number;
}

export interface DocumentListResponse {
  documents: ClientDocument[];
}

export interface FunderReportMetrics {
  summary: Record<string, number>;
  service_breakdown: Array<{ service_type: string; count: number }>;
  languages_served: Array<{ language: string; count: number }>;
  monthly_services: Array<{ month: string; count: number }>;
  appointments: Array<{ status: string; count: number }>;
  follow_ups: Array<{ status: string; count: number }>;
}

export interface FunderReportStreamMeta {
  title: string;
  org_name: string;
  start_date: string;
  end_date: string;
  period_label: string;
  metrics: FunderReportMetrics;
  raw_csv: string;
}

export interface TranslationItem {
  source_text: string;
  translated_text: string;
  from_cache: boolean;
}

export interface TranslateResponse {
  source_lang: string;
  target_lang: string;
  translations: TranslationItem[];
}
