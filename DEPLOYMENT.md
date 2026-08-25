# Beautijoo Deployment Guide

This document will be completed in Phase 16–18.

## Overview
- Backend: NestJS on Node.js
- Frontend: Next.js
- Database: PostgreSQL
- Compatible with Liara and any standard Node + PostgreSQL host

## Required Environment Variables
See `backend/.env.example` and `frontend/.env.example`.

## High-level steps
1. Provision PostgreSQL
2. Deploy backend, set DATABASE_URL and secrets, run migrations
3. Deploy frontend, set NEXT_PUBLIC_API_URL
4. Configure CORS, domain, SSL
5. Optionally configure SMS / Payment / Storage providers
