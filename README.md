# Beautijoo

پلتفرم مارکت‌پلیس و رزرو نوبت برای زیباگران (Beauty Professionals) — فارسی و RTL.

## ساختار پروژه

```
beautijoo/
├── backend/          # NestJS + Prisma + PostgreSQL
├── frontend/         # Next.js App Router (RTL, Persian)
├── docs/             # مستندات معماری، ERD، امنیت
├── scripts/          # اسکریپت‌های کمکی
├── docker/           # Docker Compose برای توسعه محلی
├── DEPLOYMENT.md     # راهنمای استقرار
└── README.md
```

## تکنولوژی‌ها

| لایه       | تکنولوژی                          |
|------------|-----------------------------------|
| Frontend   | Next.js (App Router), TypeScript, Tailwind, RTL |
| Backend    | NestJS, TypeScript, Prisma        |
| Database   | PostgreSQL                        |
| Auth       | JWT + Refresh Token + OTP-ready   |
| API        | REST `/api/v1` + Swagger          |
| Runtime / PM | Bun (اصلی) + Node.js 20+ (سازگاری) |

## شروع سریع (توسعه)

### پیش‌نیازها
- **Bun** (نسخه ۱.۱ یا بالاتر) — نصب:
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- Node.js 20+ (اختیاری؛ برای سازگاری و برخی ابزارها)
- PostgreSQL 15+
- Git

> در ریشه پروژه `bun.lock` وجود دارد. برای توسعه محلی دستورات Bun اولویت دارند.

### Backend
```bash
cd backend
cp .env.example .env
# تنظیم DATABASE_URL و JWT_SECRET
bun install
bunx prisma migrate dev
bunx prisma db seed
bun run start:dev
```

### Frontend
```bash
cd frontend
cp .env.example .env.local
# تنظیم NEXT_PUBLIC_API_URL
bun install
bun run dev
```

### از ریشه پروژه (workspaces)
```bash
bun install
bun run backend:dev   # یا: cd backend && bun run start:dev
bun run frontend:dev  # یا: cd frontend && bun run dev
```

## مستندات
- [DEPLOYMENT.md](./DEPLOYMENT.md) — راهنمای استقرار (از جمله Liara)
- `docs/` — معماری، اسکیما، امنیت

## لایسنس
Proprietary — Beautijoo
