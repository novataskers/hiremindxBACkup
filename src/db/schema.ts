import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';



// Auth tables for better-auth
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .$defaultFn(() => false)
    .notNull(),
    image: text("image"),
    phone: text("phone"),
    createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  lastSeen: integer("last_seen"),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

// Hiremind application tables
export const resumes = sqliteTable('resumes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size').notNull(),
  uploadedAt: text('uploaded_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const jobs = sqliteTable('jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  company: text('company').notNull(),
  description: text('description'),
  location: text('location'),
  salaryRange: text('salary_range'),
  jobUrl: text('job_url'),
  matchScore: integer('match_score'),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const applications = sqliteTable('applications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  jobId: integer('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  appliedAt: text('applied_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  notes: text('notes'),
});

export const jobSearches = sqliteTable('job_searches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  searchQuery: text('search_query').notNull(),
  filters: text('filters'),
  createdAt: text('created_at').notNull(),
});

// Add new tables for Hiremind enhancements
export const cvAnalysis = sqliteTable('cv_analysis', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  resumeId: integer('resume_id').references(() => resumes.id, { onDelete: 'cascade' }),
  fullName: text('full_name'),
  email: text('email'),
  phone: text('phone'),
  skills: text('skills', { mode: 'json' }),
  expertise: text('expertise'),
  jobTitles: text('job_titles', { mode: 'json' }),
  experienceYears: integer('experience_years'),
  education: text('education', { mode: 'json' }),
  summary: text('summary'),
  rawText: text('raw_text'),
  analyzedAt: text('analyzed_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const leads = sqliteTable('leads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  companyWebsite: text('company_website'),
  industry: text('industry'),
  location: text('location'),
  companySize: text('company_size'),
  matchScore: integer('match_score'),
  matchReason: text('match_reason'),
  status: text('status').notNull().default('new'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const emailCampaigns = sqliteTable('email_campaigns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  leadId: integer('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('draft'),
  sentAt: text('sent_at'),
  openedAt: text('opened_at'),
  repliedAt: text('replied_at'),
  replyContent: text('reply_content'),
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const chatSessions = sqliteTable('chat_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  chatType: text('chat_type').notNull(),
  title: text('title').notNull(),
  lastMessageAt: text('last_message_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
});

// Community Chat Tables
export const conversations = sqliteTable('conversations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(), // 'individual' or 'group'
    name: text('name'), // Only for groups
    image: text('image'), // Only for groups
    inviteToken: text('invite_token'),
    createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const conversationParticipants = sqliteTable('conversation_participants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  joinedAt: text('joined_at').notNull(),
  typingUntil: integer('typing_until'),
});

export const communityMessages = sqliteTable('community_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  attachmentUrl: text('attachment_url'),
  attachmentType: text('attachment_type'),
  status: text('status').notNull().default('sent'), // 'sent', 'delivered', 'read'
  createdAt: text('created_at').notNull(),
});

export const invitations = sqliteTable('invitations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  inviterId: text('inviter_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  conversationId: integer('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  inviteType: text('invite_type').notNull().default('individual'),
  status: text('status').notNull().default('pending'),
  createdAt: text('created_at').notNull(),
});

export const hiremindState = sqliteTable('hiremind_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  stateJson: text('state_json').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const communityProfiles = sqliteTable('community_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  userType: text('user_type').notNull(), // 'freelancer' or 'client'
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  headline: text('headline'),
  location: text('location'),
  website: text('website'),
  skills: text('skills', { mode: 'json' }),
  hourlyRate: integer('hourly_rate'),
    pricingText: text('pricing_text'), // Custom pricing display e.g. "$50/hr", "From $200/project"
    availability: text('availability'),
  workExperience: text('work_experience', { mode: 'json' }),
  cvUrl: text('cv_url'),
  portfolioUrls: text('portfolio_urls', { mode: 'json' }),
  companyName: text('company_name'),
  companyDescription: text('company_description'),
  companySize: text('company_size'),
  industry: text('industry'),
  paymentMethods: text('payment_methods', { mode: 'json' }),
  profileComplete: integer('profile_complete', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Bulk CV Analysis Tables for University/Organization Hiring
export const hiringPositions = sqliteTable('hiring_positions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(), // e.g., "Computer Science Professor"
  department: text('department').notNull(), // e.g., "Computer Science Department"
  organization: text('organization').notNull(), // e.g., "Harvard University"
  description: text('description'), // Job description and responsibilities
  requirements: text('requirements'), // Required qualifications
  preferredSkills: text('preferred_skills', { mode: 'json' }), // List of preferred skills
  experienceRequired: text('experience_required'), // e.g., "5+ years"
  educationRequired: text('education_required'), // e.g., "PhD in Computer Science"
  status: text('status').notNull().default('open'), // 'open', 'closed', 'analyzing', 'completed'
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const candidateCVs = sqliteTable('candidate_cvs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  positionId: integer('position_id').notNull().references(() => hiringPositions.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size').notNull(),
  candidateName: text('candidate_name'), // Extracted from CV
  candidateEmail: text('candidate_email'), // Extracted from CV
  candidatePhone: text('candidate_phone'), // Extracted from CV
  rawText: text('raw_text'), // Extracted text from CV
  status: text('status').notNull().default('pending'), // 'pending', 'analyzing', 'analyzed', 'error'
  uploadedAt: text('uploaded_at').notNull(),
});

export const cvAnalysisResults = sqliteTable('cv_analysis_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cvId: integer('cv_id').notNull().references(() => candidateCVs.id, { onDelete: 'cascade' }),
  positionId: integer('position_id').notNull().references(() => hiringPositions.id, { onDelete: 'cascade' }),
  overallScore: integer('overall_score').notNull(), // 0-100 score
  skillsMatch: integer('skills_match'), // 0-100
  experienceMatch: integer('experience_match'), // 0-100
  educationMatch: integer('education_match'), // 0-100
  recommendation: text('recommendation').notNull(), // 'highly_recommended', 'recommended', 'consider', 'not_recommended'
  strengths: text('strengths', { mode: 'json' }), // List of strengths
  weaknesses: text('weaknesses', { mode: 'json' }), // List of weaknesses
  summary: text('summary').notNull(), // AI-generated summary
  detailedAnalysis: text('detailed_analysis'), // Full analysis text
  suggestedDepartments: text('suggested_departments', { mode: 'json' }), // Other departments candidate might fit
  analyzedAt: text('analyzed_at').notNull(),
});

// Exam Question Generation Sessions
export const examQuestionSessions = sqliteTable('exam_question_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  topic: text('topic').notNull(),
  questionTypes: text('question_types').notNull(), // 'mcq', 'cq', 'both'
  difficulty: text('difficulty').notNull(), // 'easy', 'medium', 'hard'
  questionCount: integer('question_count').notNull(),
  instructions: text('instructions'),
  bookName: text('book_name'),
  mcqQuestions: text('mcq_questions', { mode: 'json' }), // Array of MCQ question objects
  cqQuestions: text('cq_questions', { mode: 'json' }), // Array of CQ question objects
  createdAt: text('created_at').notNull(),
});

// Freelancer Portfolio Items
export const freelancerPortfolio = sqliteTable('freelancer_portfolio', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  imageUrl: text('image_url'), // Base64 data URL or external URL
  linkUrl: text('link_url'), // External link to the project
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Freelancer Offers (services listed in the community marketplace)
export const freelancerOffers = sqliteTable('freelancer_offers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  price: integer('price').notNull(), // Starting price in dollars
  deliveryDays: integer('delivery_days').notNull(),
  imageUrl: text('image_url'), // Cover image
  tags: text('tags', { mode: 'json' }), // Array of tag strings
  status: text('status').notNull().default('active'), // 'active', 'paused', 'deleted'
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Client Projects (posted by clients in the community marketplace)
export const clientProjects = sqliteTable('client_projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  budget: text('budget').notNull(), // e.g., "$500 - $1000"
  deadline: text('deadline'), // Optional deadline text
  skills: text('skills', { mode: 'json' }), // Array of required skill strings
  status: text('status').notNull().default('open'), // 'open', 'in_progress', 'closed'
  proposals: integer('proposals').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Freelancer Proposals on Client Projects
export const proposals = sqliteTable('proposals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => clientProjects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  coverLetter: text('cover_letter').notNull(),
  bidAmount: text('bid_amount').notNull(), // e.g., "$500"
  deliveryDays: integer('delivery_days').notNull(),
  status: text('status').notNull().default('pending'), // 'pending', 'accepted', 'rejected', 'withdrawn'
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Community Direct Messages (freelancer ↔ client)
export const communityDMs = sqliteTable('community_dms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationKey: text('conversation_key').notNull(), // sorted "{userId1}_{userId2}" for dedup
  senderId: text('sender_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  receiverId: text('receiver_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  attachments: text('attachments', { mode: 'json' }), // Array of attachment objects { name, url, type }
  projectId: integer('project_id'), // optional link to a client project
  proposalId: integer('proposal_id'), // optional link to a proposal
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

// Interview Question Generation Sessions
export const interviewQuestionSessions = sqliteTable('interview_question_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  department: text('department').notNull(),
  position: text('position'), // Optional position/purpose
  difficulty: text('difficulty').notNull(), // 'easy', 'medium', 'hard'
  questionCount: integer('question_count').notNull(),
  candidateName: text('candidate_name'), // Extracted from CV or summary
  candidateSummary: text('candidate_summary').notNull(),
  keyAreasToProbe: text('key_areas_to_probe', { mode: 'json' }), // Array of strings
  questions: text('questions', { mode: 'json' }).notNull(), // Array of question objects
  createdAt: text('created_at').notNull(),
});

// Research Sessions — stores user research history for prediction engine
export const researchSessions = sqliteTable('research_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  query: text('query').notNull(), // Original user query
  topic: text('topic').notNull(), // Extracted primary topic
  keywords: text('keywords', { mode: 'json' }), // Array of extracted keywords
  entities: text('entities', { mode: 'json' }), // Array of extracted entities (companies, people, locations)
  category: text('category'), // e.g. 'hiring', 'technology', 'market', 'education'
  resultSummary: text('result_summary'), // Brief summary of what was found
  createdAt: text('created_at').notNull(),
});

// Predictions — AI-generated predictions from research memory
export const predictions = sqliteTable('predictions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  query: text('query').notNull(), // The prediction request
  prediction: text('prediction').notNull(), // AI-generated prediction text
  confidence: integer('confidence').notNull(), // 0-100 confidence score
  reasoning: text('reasoning'), // Why this prediction was made
  timelineData: text('timeline_data', { mode: 'json' }), // Past→Current→Future timeline points
  trendData: text('trend_data', { mode: 'json' }), // Supporting global trend data
  relatedSessionIds: text('related_session_ids', { mode: 'json' }), // Array of researchSession IDs used
  relatedTopics: text('related_topics', { mode: 'json' }), // Array of topic strings from user history
  createdAt: text('created_at').notNull(),
});

// Notifications
export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'contract_offer', 'message', 'alert'
  title: text('title').notNull(),
  message: text('message').notNull(),
  actionUrl: text('action_url'), // Link to act on this notification
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});