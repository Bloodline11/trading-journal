# Trading Journal — Tester Runbook (Private)

## Goal
Find bugs fast with reproducible steps. No feature requests in chat—log them.

---

## 1) Test Accounts
- Use your own email. Don’t share passwords.
- If signup fails, screenshot the exact message.

---

## 2) Required Test Flow (do in Incognito)
1. Open the app
2. Sign up (new email)
3. Confirm email (if prompted)
4. Navigate to Analytics
5. Log out
6. Log back in
7. Hard refresh (Ctrl+Shift+R)

PASS condition: no loops, no redirects, analytics loads, session persists.

---

## 3) Trade Entry Smoke Test
Create 5 trades:
- 2 wins, 2 losses, 1 breakeven
- Use at least 2 symbols (e.g., MNQ + AAPL)
- Mix long/short
- Add dates across different weekdays

PASS condition: trades list shows all rows, editing/deleting works (if supported), no duplicates.

---

## 4) Analytics Sanity Checks
- Total PnL equals sum of trade PnL
- Win rate matches wins / total
- Equity curve moves correctly after each trade
- Day/weekday views update when date filters change

PASS condition: no NaN/Infinity, no empty charts when data exists.

---

## 5) Bug Report Template (must follow)
Title:
Environment: (Chrome/Firefox/Safari + desktop/mobile)
Account email:
Steps to reproduce:
Expected:
Actual:
Screenshot/video:
Console errors: (F12 → Console → copy/paste)

---

## 6) Feature Request Template
Problem:
Why it matters:
Example:
Priority: (must / should / nice)