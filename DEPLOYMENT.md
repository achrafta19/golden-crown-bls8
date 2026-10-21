# 🚀 استضافة موقع التاج الذهبي — دليل النشر

النشر عبر: **Vercel** (مجاني، الأفضل لـ Next.js) — الأدلة أدناه.

---

## 📋 قبل البدء: قائمة التحقق

| # | المطلوب | الحالة |
|---|---|---|
| 1 | حساب GitHub | ☐ |
| 2 | حساب Vercel (مجاني) | ☐ |
| 3 | قاعدة بيانات PostgreSQL مجانية | ☐ |
| 4 | مفتاح تشفير 32+ حرف | ☐ |

---

## 1️⃣ قاعدة البيانات (Supabase — مجاني)

1. افتح **https://supabase.com** ← حساب مجاني
2. **New Project** ← اختر اسمًا ←free tier (2 databases)
3. من **Settings ← Database** ← انسخ **Connection string**
4. غيّر `postgres` → `postgres.<ref>` في جزء كلمة السر

النتيجة:

postgresql://postgres.<project-ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres

---

## 2️⃣ مفتاح التشفير (إجباري)

ولّد مفتاحًا عشوائيًاStrong:

```bash
openssl rand -base64 48
# أو
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

> ⚠️ **احفظه في مكان آمن** — فقدان هذا المفتاح = فقدان بيانات العملاء المشفّرة.

---

## 3️⃣ الرفع إلى GitHub

```bash
cd <مجلد المشروع>
git init
git add .
git commit -m "Golden Crown BLS — initial release"
git branch -M main
git remote add origin https://github.com/<اسمك>/<اسم-المستودع>.git
git push -u origin main
```

> `.env` **مستثنى** من Git ✅ (موجود في `.gitignore`)

---

## 3️⃣½ فحص ما قبل النشر (محلي)

بعد ضبط المتغيرات، شغّل الفحص محليًا:

```bash
npm run preflight
```

المتوقع:
```
✓ DATABASE_URL           set
✓ OPERATOR_PASSWORD      set
✓ DATA_ENCRYPTION_KEY    set
✓ All configuration present.
```

> ❌ إذا ظهر `✗` لأي متغير مطلوب — **لا تنشر**، أكمل المتغيرات أولاً.

---

## 4️⃣ النشر على Vercel

### الطريقة A — من الواجهة (الأسهل)
1. افتح **https://vercel.com** ← **Add New... ← Project**
2. **Import** مستودع GitHub
3. أضف **Environment Variables**:

| المفتاح | القيمة |
|---|---|
| `DATABASE_URL` | من Supabase (الخطوة 1) |
| `DATA_ENCRYPTION_KEY` | من الخطوة 2 |
| `OPERATOR_USERNAME` | `blsvisa` |
| `OPERATOR_PASSWORD` | ⚠️ **كلمة سر قوية** |
| `OPERATOR_EMAIL` | بريدك للاسترداد |
| `OPERATOR_PHONE` | `+213...` |
| `SMTP_HOST` | `smtp.gmail.com` *(اختياري)* |
| `SMTP_USER` | بريدك |
| `SMTP_PASS` | كلمة مرور التطبيق |
| `SMTP_FROM` | بريدك |

4. **Deploy** ✅

### الطريقة B — من الطرفية
```bash
npm i -g vercel
vercel login
vercel --prod
vercel env add DATABASE_URL production
# ... كرّر لكل متغير
vercel --prod
```

---

## 5️⃣ إنشاء الجداول

```bash
# بعد نجاح النشر
npx drizzle-kit push --force
```

أو من **Vercel Dashboard ← Project ← Settings ← Build & Deploy** أضف:

```bash
"build": "npm run build && npm run db:push"
```

> ✅ **هذا هو الأفضل** — ينفّذ تلقائيًا عند كل نشر.

---

## 6️⃣ بعد النشر checklist

- [ ] `https://<your-domain>.vercel.app/api/health` ← يرجع `"ok": true`
- [ ] `/operator` ← دخول بـ `blsvisa` + كلمة السر الجديدة
- [ ] **⚙️ الإعدادات ← تغيير كلمة السر** (لمسة أمان)
- [ ] **⚙️ الإعدادات ← 🔗 ربط BLS** ← ضع رابط موقع الحجز وكود التحقق
- [ ] **⚡ الطابور ← تفعيل المحرك**
- [ ] **🔌 الجسر** ← ثبّت الامتداد وارقمنى الكود

---

## 🔐 أمان الإنتاج — 반드시

| الإجراء | لماذا |
|---|---|
| ⚠️ **غيّر كلمة سر المشغّل** | الافتراضي معروف |
| 🔑 **استخدم `DATA_ENCRYPTION_KEY`** | بدونه مفتاح التشفير مشتق من رابط قاعدة البيانات |
| 📧 **اضبط SMTP** | وإلا لن يعمل استرداد كلمة السر عبر البريد |
| 🔒 **تأكد من CORS** | راجعها بعد النشر |

---

## 🌍 بدائل (لو أردت)

### Railway.app (مع قاعدة بيانات)
بسيط، **قاعدة البيانات في نفس المكان**، ~$5/شهر.

### VPS (تحكم كامل)
- DigitalOcean / Hetzner
- Docker + PostgreSQL + Nginx + SSL
- تحتاج إدارة يدوية

---

## ❓ أسئلة شائعة

**Q: هل البيانات تبقى بعد النشر؟**
نعم ✅ إذا استخدمت Supabase/Neon (خارجي). **لا** إذا استخدمت Vercel Postgres ephemeral.

**Q: هل الامتداد يعمل مع النطاق الجديد؟**
نعم ✅ لكن حدّث عنوان السيرفر في الامتداد بعد التثبيت.

**Q: لماذا لا تعمل استرداد كلمة السر؟**
يحتاج SMTP. اضبطه أو ستظهر كلمة السر الجديدة في الكونسول.

---

> ⚠️ **تنبيه**: الموقع أداة مساعدة للحجز، وكل مسؤولية الحجز النهائي على المستخدم. احترم شروط استخدام BLS International.