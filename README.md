# ניהול קליניקה

מערכת Web פרטית לניהול קליניקה של מרפאה בעיסוק.

## שלב נוכחי

שלב 1 של ה-MVP כולל:

- תשתית Next.js + TypeScript
- ממשק עברי מלא ו-RTL
- כניסה פרטית בסיסית באמצעות סיסמה שמוגדרת בצד שרת
- דשבורד ראשוני מוכן להמשך

## הרצה מקומית

יש להשתמש ב-`npm.cmd` ב-Windows אם PowerShell חוסם את `npm.ps1`.

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

אם עדיין לא הותקנו חבילות, אפשר לפתוח מצב תצוגה מקומי ללא התקנות:

```powershell
npm.cmd run demo
```

לפני כניסה למערכת יש להגדיר ב-`.env.local`:

- `APP_PASSWORD_HASH`
- `SESSION_SECRET`

הסיסמה עצמה לא נשמרת בקוד.

יצירת hash לסיסמה:

```powershell
npm.cmd run hash-password -- "your-password"
```
