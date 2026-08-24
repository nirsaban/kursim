You are performing the **final reverse-engineering audit of an existing production POC course platform**.

The system is already working with real customers, sells real courses, accepts real payments, and is considered functionally successful.

Your job is **NOT to redesign or improve the system yet**.

Your job is to make sure we have a **complete, accurate, implementation-independent specification of the existing system** so another architecture team can later design and rebuild it from scratch as a modular, scalable production platform.

Treat the running application and source code as the source of truth.

Do not assume that existing code structure, database structure, APIs, naming, or architecture should be preserved.

Before finishing, perform a COMPLETE GAP ANALYSIS and verify that all of the following have been documented.

# 1. Executive System Overview

Document:

- What the product does
- Who uses it
- What business problem it solves
- Current customer journey
- Current monetization model
- Courses/products currently sold
- Major system capabilities
- Major integrations
- Major technical components
- Known limitations of the POC

Clearly distinguish:

- Business/product behavior
- Current implementation decisions
- Technical debt
- Temporary POC shortcuts

# 2. Complete Feature Inventory

Identify EVERY existing user-facing and admin-facing feature.

Group features by domain/capability.

Examples may include:

- Authentication
- User registration
- Login/logout
- Password recovery
- User profiles
- Course catalog
- Course landing pages
- Course structure
- Modules
- Lessons
- Video/content delivery
- Course purchase
- Cart/checkout if applicable
- Orders
- Payments
- Payment callbacks/webhooks
- Enrollment
- Course access
- Entitlements
- Learning progress
- Lesson completion
- Assessments
- Certificates
- Emails
- Notifications
- Admin functionality
- Customer management
- Course management
- Pricing
- Coupons/discounts
- Refunds
- Analytics
- Reporting
- Audit/logging
- Scheduled/background jobs
- File uploads
- Media handling
- Integrations

For every feature specify:

- Description
- Actor
- Trigger
- Preconditions
- Main flow
- Alternative flows
- Failure flows
- Business rules
- Permissions
- Data used
- Data created/modified
- External integrations
- Side effects
- Emails/notifications
- Acceptance criteria
- Known edge cases

Do not omit small features simply because they appear technically insignificant.

# 3. User Roles and Authorization

Identify every actor and role.

Document:

- Anonymous visitor
- Customer/student
- Admin
- Course manager/instructor if applicable
- Support/operator roles
- System/service accounts
- Any other role

For each role document:

- Allowed operations
- Forbidden operations
- Resource ownership rules
- Access-control logic
- Admin overrides
- Authorization checks in frontend
- Authorization checks in backend
- Any inconsistencies or vulnerabilities

Produce a permissions matrix.

# 4. Complete User Journeys

Document end-to-end journeys, not only screens.

At minimum inspect:

Visitor → Course → Purchase → Payment → User/Account → Enrollment → Course Access → Lesson Consumption → Progress

Also document:

- Returning customer
- Failed payment
- Retried payment
- Duplicate payment callback
- Existing user purchasing another course
- Customer accessing purchased course
- Customer attempting unauthorized access
- Logout/login after purchase
- Password recovery
- Admin managing users
- Admin managing courses
- Admin checking payments/orders
- Refund/cancellation if present

Include sequence diagrams when useful.

# 5. Business Rules

Extract EVERY business rule embedded in:

- Application services
- Controllers/routes
- UI logic
- Database constraints
- Stored procedures
- Triggers
- Middleware
- Payment handlers
- Background jobs
- Configuration
- Environment variables

Examples:

- Who may purchase
- Whether login is required before checkout
- What creates an enrollment
- What grants course access
- What happens after successful payment
- What happens after failed payment
- Whether duplicate purchases are allowed
- Whether prices can change
- Course publication rules
- Lesson visibility rules
- Progress calculation rules
- Refund implications
- Access expiration rules

Clearly separate explicit business rules from accidental behavior caused by the implementation.

# 6. Domain Model

Identify all important business concepts.

Examples:

User
Customer
Course
Module
Lesson
Content
Product
Price
Order
OrderItem
Payment
Transaction
Enrollment
Entitlement
Progress
LessonCompletion
Coupon
Refund
Certificate
Notification

For each domain concept specify:

- Definition
- Responsibility
- Lifecycle
- State transitions
- Relationships
- Invariants
- Which existing code currently owns it

Do NOT simply copy database table names.

Infer the actual business concepts represented by the system.

# 7. Database Reverse Engineering

Provide a COMPLETE database specification.

For every:

- Schema
- Table
- Column
- Type
- Primary key
- Foreign key
- Unique constraint
- Check constraint
- Default
- Index
- Sequence
- View
- Materialized view
- Trigger
- Function
- Procedure

Document its purpose.

For every table describe:

- Business meaning
- Who writes to it
- Who reads from it
- Important lifecycle behavior
- Relationships
- Cardinality
- Deletion behavior
- Referential integrity

Also identify:

- Missing constraints
- Duplicate data
- Denormalization
- Orphan risks
- Nullable fields with implicit meaning
- JSON/blob fields hiding domain data
- Historical/audit data
- Sensitive/PII data
- Payment-related data
- Generated identifiers

Produce an ERD.

# 8. Data Ownership

For every major entity identify the logical domain that owns it.

For example:

Identity → Users

Course → Courses / Modules / Lessons

Commerce → Products / Prices / Orders / Payments

Enrollment → Enrollment / Entitlements

Learning → Progress / Completion

Do not force ownership based on the current folder structure.

Call out entities whose ownership is currently mixed or ambiguous.

# 9. API Inventory

Document every backend endpoint/API operation.

For every endpoint provide:

- HTTP method
- Route
- Authentication requirement
- Authorization
- Request parameters
- Request body
- Validation
- Response format
- Error responses
- Database effects
- Side effects
- External service calls
- Events/webhooks
- Idempotency behavior
- Consumers

Also identify:

- Internal APIs
- Public APIs
- Admin APIs
- Payment webhook endpoints
- Undocumented endpoints
- Dead/unused endpoints

Produce an API inventory table.

# 10. Frontend Architecture

Document:

- Routes/pages
- Major components
- State management
- API clients
- Authentication state
- Authorization behavior
- Forms
- Validation
- Error handling
- Loading states
- Payment UI
- Course-player behavior
- Client-side persistence
- Cookies
- Local/session storage

Map pages to backend APIs.

Highlight business logic implemented only in the frontend.

# 11. Payments and Commerce — CRITICAL

Perform a deep audit of all payment behavior.

Document:

- Payment provider
- Checkout flow
- Product representation
- Price representation
- Currency
- Order creation
- Payment creation
- Provider transaction IDs
- Redirects
- Success pages
- Failure pages
- Payment verification
- Webhooks/callbacks
- Signatures
- Security verification
- Retries
- Timeouts
- Duplicate callback handling
- Idempotency
- Payment statuses
- Order statuses
- Enrollment/access creation
- Reconciliation
- Refund behavior
- Failed payments
- Partial/abandoned payments

Provide an exact sequence diagram from:

Customer clicks purchase

through:

Payment provider interaction

through:

Verified successful payment

through:

Course access granted.

Explicitly identify which component currently decides that a customer has paid and which component grants access.

This is one of the highest-priority areas of the audit.

# 12. Enrollment and Entitlements

Determine precisely how the current system answers:

"Can this user access this course?"

Document:

- How enrollment is created
- What enrollment means
- Whether enrollment equals access
- Whether payment directly controls access
- Whether access can exist without payment
- Manual/admin grants
- Expiration
- Revocation
- Multiple purchases
- Course ownership rules
- Authorization checks

Identify any coupling between payments and course access.

# 13. Course and Content Model

Document:

- Course lifecycle
- Draft/published state
- Modules
- Lessons
- Ordering
- Content types
- Video
- Files
- Text
- External resources
- Visibility
- Preview/free content
- Course updates
- Content deletion
- Media storage

Include entity relationships and ordering logic.

# 14. Learning State

Document exactly how learning progress works.

Include:

- Lesson started
- Lesson completed
- Course progress
- Percent calculations
- Last accessed lesson
- Resume behavior
- Completion
- Assessments if present
- Certificates if present

Identify whether progress data can be rebuilt or is authoritative.

# 15. External Integrations

Inventory every external dependency.

Examples:

- Payment gateways
- Email providers
- SMS
- CDN
- Video provider
- Object storage
- Authentication provider
- Analytics
- CRM
- Webhooks
- Third-party APIs

For each document:

- Purpose
- Direction of communication
- Credentials/configuration
- Important API operations
- Failure handling
- Retries
- Timeouts
- Webhooks
- Data exchanged

# 16. Background Processing

Identify:

- Cron jobs
- Queues
- Workers
- Scheduled functions
- Retry processes
- Cleanup jobs
- Email jobs
- Payment reconciliation
- Async processing

Document trigger, inputs, outputs, retries, and failure behavior.

# 17. Events and Side Effects

Identify important implicit or explicit events.

Examples:

UserRegistered
OrderCreated
PaymentSucceeded
PaymentFailed
CoursePurchased
EnrollmentCreated
CourseAccessGranted
LessonCompleted
CourseCompleted

Even if the existing implementation does NOT have an event system, document conceptual events where important state transitions occur.

Explain the current side effects attached to each transition.

# 18. Email and Notifications

Inventory every message sent by the system.

For each:

- Trigger
- Recipient
- Template
- Variables
- Sending provider
- Failure behavior
- Retry behavior

# 19. Configuration

Document every meaningful configuration value and environment variable.

Group into:

- Application
- Database
- Authentication
- Payments
- Email
- Storage
- URLs
- Security
- Logging
- Third-party integrations

Do NOT expose secret values.

Document purpose only.

# 20. Security Review

Document the CURRENT security architecture.

Inspect:

- Password handling
- Sessions/tokens
- JWT if used
- Cookies
- CSRF
- CORS
- XSS risks
- SQL injection protections
- Authorization
- Admin access
- Secrets
- Payment verification
- Webhooks
- File uploads
- PII
- Logging of sensitive information

Separate:

CURRENT BEHAVIOR

from:

SECURITY RISK / RECOMMENDATION

Do not modify behavior during this audit.

# 21. Error Handling

Document how the existing system handles:

- Validation errors
- Authentication errors
- Authorization errors
- Database errors
- Payment errors
- Integration failures
- Network failures
- Unexpected exceptions
- Frontend failures

Identify user-visible behavior and logging behavior.

# 22. Logging and Observability

Document existing:

- Application logs
- Error logs
- Audit logs
- Payment logs
- Access logs
- Metrics
- Health checks
- Monitoring
- Alerting
- Tracing

Identify important production flows that currently cannot be observed reliably.

# 23. Infrastructure and Deployment

Document the current environment:

- Hosting provider
- Servers/services
- Containers
- Runtime
- Reverse proxy
- DNS
- TLS
- Database hosting
- Storage
- CDN
- CI/CD
- Build process
- Deployment process
- Environment strategy
- Secrets management
- Backups
- Restore process

Produce a current deployment diagram.

# 24. Dependencies

Inventory major application dependencies.

For each major dependency record:

- Name
- Version
- Purpose
- Where used
- Whether it is core or incidental

Identify outdated, deprecated, or POC-only dependencies separately.

# 25. Current Architecture

Produce a current-state architecture diagram covering:

Client
Frontend
Backend
Database
Payment provider
Storage
Email
External integrations
Background processing

Explain request flows and important coupling.

# 26. Architectural Coupling

Identify places where current concerns are tightly coupled.

Examples:

Payment ↔ Enrollment

Course ↔ UI

Authentication ↔ Database

Admin ↔ Internal tables

Email ↔ Business logic

Frontend ↔ Database representation

Mark each coupling as:

- Intentional business dependency
- Implementation dependency
- Technical debt
- Unknown / needs decision

# 27. Technical Debt

Create a separate technical-debt inventory.

For each item include:

- Description
- Impact
- Risk
- Current workaround
- Whether behavior must be preserved
- Whether implementation should NOT be copied

Do NOT confuse technical debt with product requirements.

# 28. Hidden Behavior and Edge Cases

Search specifically for behavior hidden inside:

- Conditional statements
- Database queries
- Magic values
- Status strings
- Middleware
- UI visibility conditions
- Error recovery
- Provider callbacks
- Environment flags

Document anything that may otherwise be missed by reading only happy-path code.

# 29. Status and State Machines

Identify entities with lifecycle states.

Examples:

User
Course
Order
Payment
Enrollment
Refund

For each produce:

- Possible states
- Valid transitions
- Transition triggers
- Invalid transitions
- Side effects

Use state diagrams where useful.

# 30. Identifier Strategy

Document identifiers currently used:

- User IDs
- Course IDs
- Order IDs
- Payment IDs
- External provider IDs

Describe:

- Generation method
- Exposure to clients
- External mapping
- Collision/sequence implications

# 31. Data Classification

Classify important data as:

- Public
- Internal
- PII
- Authentication/security-sensitive
- Payment-sensitive
- Financial
- Audit/compliance

Do not expose real customer data in the documentation.

# 32. Tests

Document the current automated test coverage.

Inventory:

- Unit tests
- Integration tests
- End-to-end tests
- Payment tests
- Authorization tests

Identify critical production behavior that currently has no automated coverage.

# 33. Current Production Risks

Create a prioritized list:

P0 — Critical
P1 — High
P2 — Medium
P3 — Low

Focus especially on risks involving:

- Payment correctness
- Unauthorized course access
- Data loss
- Duplicate payments
- Duplicate enrollment
- Security
- Production outages
- Customer data
- Backups

# 34. Unknowns

Do not guess.

Create an explicit `UNKNOWN / REQUIRES HUMAN CONFIRMATION` section.

For every uncertain behavior include:

- Question
- Code/evidence inspected
- Why it cannot be determined
- Recommended person or source to confirm it

# 35. Evidence Mapping

Every major requirement should be traceable back to evidence.

Where possible reference:

- Source file
- Class/function
- API route
- Database object
- UI page/component
- Configuration
- Test

We want to distinguish:

OBSERVED

INFERRED

ASSUMED

UNKNOWN

# 36. Final Capability Map

Produce a hierarchical capability map of the entire current product.

Example format:

Platform
├── Identity
├── Customer Management
├── Course Management
├── Catalog
├── Commerce
│   ├── Products
│   ├── Pricing
│   ├── Orders
│   └── Payments
├── Enrollment / Access
├── Learning
├── Communications
├── Administration
├── Analytics
└── Platform Operations

Use the actual capabilities discovered in the application.

# 37. Dependency Map

Show dependencies between product capabilities.

For example:

Payment
→ Order
→ Entitlement
→ Enrollment
→ Course Access

Do not propose new architecture yet.

Describe what exists today.

# 38. Rebuild Classification

For each capability classify:

A — Proven product behavior that must initially be preserved

B — Product behavior that needs business clarification

C — Implementation detail that should NOT automatically be copied

D — Technical debt / POC workaround

E — Dead or apparently unused behavior

This classification is extremely important for the rebuild.

# 39. PRD Quality Audit

Review every PRD you already created and verify that it contains:

- Problem / purpose
- Actors
- User stories/use cases
- Preconditions
- Functional requirements
- Business rules
- Validation rules
- Main flow
- Alternative flows
- Failure flows
- Permissions
- Data requirements
- Integration requirements
- Side effects
- Edge cases
- Acceptance criteria

If something is missing, update the PRD.

# 40. Technical Documentation Quality Audit

Review the technical design documentation and confirm that it covers:

- Current architecture
- Database
- APIs
- Frontend
- Backend
- Authentication
- Authorization
- Payments
- Enrollment/access
- Integrations
- Background processing
- Configuration
- Deployment
- Security
- Logging
- Error handling
- Tests

Fill all gaps before finishing.

# FINAL REQUIRED OUTPUT

At the end, provide a document index containing every artifact produced.

At minimum I expect:

1. Executive System Overview
2. Complete Feature Inventory
3. Product Capability Map
4. PRDs
5. Actors & Permissions Matrix
6. Business Rules Catalog
7. User Journey Documentation
8. Domain Model
9. Current Database Specification
10. ERD
11. Data Ownership Map
12. API Inventory
13. Frontend Architecture
14. Backend Architecture
15. Payment & Commerce Specification
16. Enrollment / Entitlement Specification
17. Course & Content Specification
18. Learning Progress Specification
19. Integration Inventory
20. Events / Side Effects Catalog
21. Background Jobs Inventory
22. Notifications Inventory
23. Configuration Inventory
24. Security Assessment
25. Error Handling Analysis
26. Logging / Observability Analysis
27. Infrastructure / Deployment Specification
28. Current Architecture Diagram
29. State Machines
30. Technical Debt Register
31. Production Risk Register
32. Unknowns / Questions
33. Evidence / Traceability Matrix
34. Rebuild Classification
35. Dependency Map

# FINAL INSTRUCTION

Do not stop merely because the existing documents appear complete.

Perform one final repository-wide audit and actively search for:

- undocumented routes
- undocumented tables
- hidden business rules
- status values
- scheduled jobs
- payment callbacks
- background processing
- admin-only behavior
- environment-dependent behavior
- security checks
- integrations
- unused/dead behavior
- edge cases

Compare those findings against the documentation.

Your final answer must explicitly state:

**READY FOR REBUILD ARCHITECTURE REVIEW**

only if you believe the documentation is sufficiently complete for a separate architecture team to design the new system without needing to reverse engineer the POC again.

If not, state:

**NOT READY FOR REBUILD ARCHITECTURE REVIEW**

and provide a precise list of missing information.

Do NOT design the new architecture.

Do NOT choose the new technology stack.

Do NOT refactor the application.

Do NOT modify production behavior.

Your responsibility is to give the next architecture team the most accurate possible representation of **what exists, what the business currently does, what behavior is proven, what is implementation-specific, and what remains unknown**.