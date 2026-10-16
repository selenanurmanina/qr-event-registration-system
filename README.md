# qr-event-registration-system
QR-based event registration and attendance system built with Google Apps Script and Google Sheets.


# 🎟️ AISINDO QR Attendance System

A web-based workshop registration and attendance management system built with **Google Apps Script, Google Sheets, HTML, CSS, and JavaScript**.

This project is designed to simplify participant registration, digital ticket management, and QR-based check-in for AISINDO workshops and events.

## ✨ Features

- 📝 **Participant Registration** — Register participants with their full name, email, institution, and ticket type.
- 🎫 **Digital Ticket Management** — Generate a unique participant ID and ticket token.
- 📱 **QR Code Check-in** — Scan participant QR tickets using a camera.
- 🔎 **Manual Check-in** — Verify attendance using a participant ID when QR scanning is unavailable.
- 📅 **Multi-day Attendance** — Support for Day 1, Day 2, and two-day bundled tickets.
- 🔄 **Ticket Recovery** — Retrieve ticket information using the registered email and full name.
- 🔐 **Staff Authentication** — Separate admin and staff roles for attendance operations.
- 📊 **Attendance Dashboard** — View registration statistics, check-in records, and audit logs.
- ⚙️ **Event Configuration** — Manage event dates, schedules, location, and registration status.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Google Apps Script | Backend logic and web application |
| Google Sheets | Participant database and attendance records |
| HTML5 | Web page structure |
| CSS3 | User interface and responsive styling |
| JavaScript | Frontend interactions and API requests |
| HTML5 QR Code | QR scanning functionality |

## 🏗️ System Architecture

```text
Participant / Event Committee
            |
            v
     Web Application
       HTML / CSS / JS
            |
            v
     Google Apps Script
       Backend / API
            |
            v
       Google Sheets
  Participants / Attendance
  EventConfig / AuditLog
```

## 📂 Project Structure

```text
aisindo-qr-attendance-system/
├── Code.gs
├── Index.html
└── README.md
```

The scanner interface can be maintained as a separate HTML page if deployed independently.

## 🚀 Getting Started

### Prerequisites

- A Google account
- Access to Google Apps Script
- A Google Spreadsheet
- A modern web browser with camera access for QR scanning

### Installation

1. Create a Google Spreadsheet for the application database.
2. Open **Extensions → Apps Script**.
3. Add the backend code from `Code.gs`.
4. Create the HTML files required by the application.
5. Configure the event dates, registration settings, and ticket ID prefix.
6. Run the setup function and authorize the requested permissions.
7. Deploy the application as a web app.
8. Configure the scanner frontend with the appropriate backend endpoint.
9. Test participant registration, ticket retrieval, and check-in before using the system for a live event.

## 📋 Attendance Workflow

1. Participants register for the workshop.
2. The system generates a unique ticket ID and token.
3. Participants retrieve their ticket for event entry.
4. The committee scans the QR code or enters the participant ID.
5. The backend validates ticket status, event day, and previous attendance.
6. Attendance records and audit logs are stored in Google Sheets.

## 🔒 Security Considerations

- Use strong, unique credentials for administrator and staff accounts.
- Do not commit passwords, PINs, API secrets, or private participant data.
- Restrict access to the Google Spreadsheet and Apps Script project.
- Validate all registration and check-in requests on the server.
- Use HTTPS and authorized access for administrative operations.

## 🎯 Project Goals

- Reduce manual attendance recording.
- Minimize paper-based registration workflows.
- Improve the accuracy of attendance records.
- Simplify multi-day workshop attendance management.
- Provide a practical, low-cost event management solution.

## 👩‍💻 Author

Developed as a digital event management project for AISINDO workshops.

---

*Built with Google Apps Script, Google Sheets, and JavaScript.*
