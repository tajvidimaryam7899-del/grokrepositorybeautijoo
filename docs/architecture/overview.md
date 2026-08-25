# Beautijoo Architecture Overview

## Principles
- Single source of truth: this repository
- Backend is authority for all business rules
- Frontend is API-driven (no permanent mocks in production)
- Provider abstractions for SMS, Payment, Storage
- Portable Node.js + PostgreSQL (Liara-compatible)
- Persian RTL first-class citizen

## Layers
1. Presentation (Next.js App Router, RTL)
2. API (NestJS REST /api/v1)
3. Domain services (booking, availability, auth, RBAC)
4. Persistence (Prisma + PostgreSQL + RLS-ready)
5. External adapters (SmsProvider, PaymentProvider, StorageProvider)

## Key Modules (Backend)
- auth, users, professionals, services, locations
- availability, bookings, payments, reviews
- favorites, notifications, admin, audit
