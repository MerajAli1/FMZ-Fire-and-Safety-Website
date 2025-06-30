const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors());

// Replace with your SMTP credentials
const transporter = nodemailer.createTransport({
    host: 'smtp.example.com', // e.g. smtp.gmail.com
    port: 465, // or 587 for TLS
    secure: true, // true for 465, false for 587
    auth: {
        user: 'your_email@example.com',
        pass: 'your_email_password_or_app_password'
    }
});

app.post('/send-email', async (req, res) => {
    const { to, subject, text, html } = req.body;
    try {
        await transporter.sendMail({
            from: '"FMZ Admin" <your_email@example.com>',
            to,
            subject,
            text,
            html
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(3001, () => console.log('Email server running on port 3001'));
