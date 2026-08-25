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

## شروع سریع (توسعه)

### پیش‌نیازها
- Node.js 20+
- PostgreSQL 15+
- npm یا pnpm

### Backend
```bash
cd backend
cp .env.example .env
# تنظیم DATABASE_URL و JWT_SECRET
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

### Frontend
```bash
cd frontend
cp .env.example .env.local
# تنظیم NEXT_PUBLIC_API_URL
npm install
npm run dev
```

## مستندات
- [DEPLOYMENT.md](./DEPLOYMENT.md) — راهنمای استقرار روی Node/PostgreSQL (از جمله Liara)
- `docs/` — معماری، اسکیما، امنیت

## لایسنس
Proprietary — Beautijoo
