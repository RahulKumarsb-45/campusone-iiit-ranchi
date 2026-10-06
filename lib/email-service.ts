import nodemailer from "nodemailer"
import QRCode from "qrcode"

import "server-only"

// Created lazily so the app still runs when email is not configured.
let cached: ReturnType<typeof nodemailer.createTransport> | null = null
function getTransporter() {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) return null
  if (!cached) {
    cached = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === "true",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    })
  }
  return cached
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

export async function sendRegistrationEmail(
  to: string,
  eventTitle: string,
  eventDate: string,
  eventLocation: string,
  isPaid = false,
  paymentInfo?: {
    amount: number
    paymentUrl: string
  },
) {
  let qrCodeDataUrl = ""

  if (isPaid && paymentInfo) {
    // Generate QR code for payment
    qrCodeDataUrl = await QRCode.toDataURL(paymentInfo.paymentUrl)
  }

  const formattedDate = new Date(eventDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #1e3a8a;">CampusOne – IIIT Ranchi</h1>
        <p style="font-size: 18px; color: #4b5563;">Registration Confirmation</p>
      </div>
      
      <div style="margin-bottom: 30px;">
        <p>Thank you for registering for <strong>${esc(eventTitle)}</strong>!</p>
        <p>We're excited to have you join us for this event.</p>
      </div>
      
      <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h2 style="font-size: 16px; margin-top: 0;">Event Details</h2>
        <p><strong>Date & Time:</strong> ${formattedDate}</p>
        <p><strong>Location:</strong> ${esc(eventLocation)}</p>
      </div>
      
      ${
        isPaid && paymentInfo
          ? `
        <div style="background-color: #f0f9ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; text-align: center;">
          <h2 style="font-size: 16px; margin-top: 0;">Payment Information</h2>
          <p>Please complete your payment of <strong>₹${paymentInfo.amount}</strong> to confirm your registration.</p>
          <p>Scan the QR code below or <a href="${paymentInfo.paymentUrl}" style="color: #1e3a8a;">click here</a> to make your payment.</p>
          <img src="${qrCodeDataUrl}" alt="Payment QR Code" style="max-width: 200px; margin: 10px auto; display: block;" />
        </div>
      `
          : ""
      }
      
      <div style="margin-top: 30px; font-size: 14px; color: #6b7280; text-align: center;">
        <p>If you have any questions, please contact us at your CampusOne event coordinator</p>
        <p>© ${new Date().getFullYear()} CampusOne – IIIT Ranchi. All rights reserved.</p>
      </div>
    </div>
  `

  const mailOptions = {
    from: `"CampusOne – IIIT Ranchi" <${process.env.EMAIL_FROM}>`,
    to,
    subject: `Registration Confirmation: ${esc(eventTitle)}`,
    html: emailContent,
  }

  try {
    const transporter = getTransporter()
    if (!transporter) return { success: false, error: "Email is not configured" }
    await transporter.sendMail(mailOptions)
    return { success: true }
  } catch (error) {
    console.error("Error sending email:", error)
    return { success: false, error }
  }
}

export async function sendVolunteerConfirmationEmail(
  to: string,
  eventTitle: string,
  eventDate: string,
  volunteerRole: string,
) {
  const formattedDate = new Date(eventDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #1e3a8a;">CampusOne – IIIT Ranchi</h1>
        <p style="font-size: 18px; color: #4b5563;">Volunteer Confirmation</p>
      </div>
      
      <div style="margin-bottom: 30px;">
        <p>Thank you for volunteering for <strong>${esc(eventTitle)}</strong>!</p>
        <p>We appreciate your willingness to help make this event a success.</p>
      </div>
      
      <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h2 style="font-size: 16px; margin-top: 0;">Volunteer Details</h2>
        <p><strong>Event:</strong> ${esc(eventTitle)}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Role:</strong> ${esc(volunteerRole)}</p>
      </div>
      
      <div style="background-color: #f0f9ff; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h2 style="font-size: 16px; margin-top: 0;">Next Steps</h2>
        <p>The event coordinator will contact you soon with more details about your role and responsibilities.</p>
        <p>Please make sure to arrive 30 minutes before the event starts for a brief orientation.</p>
      </div>
      
      <div style="margin-top: 30px; font-size: 14px; color: #6b7280; text-align: center;">
        <p>If you have any questions, please contact us at your CampusOne event coordinator</p>
        <p>© ${new Date().getFullYear()} CampusOne – IIIT Ranchi. All rights reserved.</p>
      </div>
    </div>
  `

  const mailOptions = {
    from: `"CampusOne – IIIT Ranchi" <${process.env.EMAIL_FROM}>`,
    to,
    subject: `Volunteer Confirmation: ${esc(eventTitle)}`,
    html: emailContent,
  }

  try {
    const transporter = getTransporter()
    if (!transporter) return { success: false, error: "Email is not configured" }
    await transporter.sendMail(mailOptions)
    return { success: true }
  } catch (error) {
    console.error("Error sending email:", error)
    return { success: false, error }
  }
}
